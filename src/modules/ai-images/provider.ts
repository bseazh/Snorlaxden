import sharp, { type Metadata } from 'sharp'

import { AIImageError } from './domain'

export type ProviderUsage = { generatedImages: number; inputImages: number; outputTokens: number; totalTokens: number }
export type ProviderImage = { bytes: Uint8Array; height: number; mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; width: number }

type FetchLike = typeof fetch

function config() {
  return {
    apiKey: process.env.AI_IMAGE_API_KEY || '',
    baseURL: process.env.AI_IMAGE_BASE_URL || 'https://www.sophnet.com/api/open-apis/projects/easyllms/imagegenerator',
    model: process.env.AI_IMAGE_MODEL || 'Doubao-Seedream-5.0-pro',
    allowedHosts: new Set((process.env.AI_IMAGE_DOWNLOAD_HOSTS || 'ark-acg-cn-beijing.tos-cn-beijing.volces.com').split(',').map((item) => item.trim()).filter(Boolean)),
  }
}

function validateEndpoint(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.hostname !== 'www.sophnet.com' || url.pathname !== '/api/open-apis/projects/easyllms/imagegenerator') {
    throw new AIImageError('IMAGE_PROVIDER_CONFIGURATION_INVALID', '图片服务地址不符合安全策略。', 503)
  }
  return url.toString()
}

function signal(timeout: number) {
  return AbortSignal.timeout(timeout)
}

function providerFailure(status: number) {
  if (status === 401 || status === 403) return new AIImageError('IMAGE_PROVIDER_UNAUTHORIZED', '图片服务鉴权失败。', 503)
  if (status === 429) return new AIImageError('IMAGE_PROVIDER_RATE_LIMITED', '图片服务当前限流，请稍后重试。', 503)
  return new AIImageError('IMAGE_PROVIDER_FAILED', '图片服务暂时不可用。', 503)
}

export class SophnetImageProvider {
  readonly name = 'sophnet' as const

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  get model() { return config().model }

  isConfigured() {
    const current = config()
    return process.env.AI_IMAGE_ENABLED === 'true' && Boolean(current.apiKey && current.model)
  }

  async generate(input: { prompt: string; referenceBytes: Uint8Array; referenceMimeType: string }): Promise<{ image: ProviderImage; usage: ProviderUsage }> {
    const current = config()
    if (!this.isConfigured()) throw new AIImageError('IMAGE_PROVIDER_DISABLED', 'AI 图片功能尚未启用。', 503)
    const endpoint = validateEndpoint(current.baseURL)
    let response: Response
    try {
      response = await this.fetchImpl(endpoint, {
        body: JSON.stringify({
          image: `data:${input.referenceMimeType};base64,${Buffer.from(input.referenceBytes).toString('base64')}`,
          model: current.model,
          prompt: input.prompt,
          size: '1K',
          watermark: false,
        }),
        headers: { Authorization: `Bearer ${current.apiKey}`, 'Content-Type': 'application/json' },
        method: 'POST',
        redirect: 'error',
        signal: signal(120_000),
      })
    } catch {
      throw new AIImageError('IMAGE_PROVIDER_UNAVAILABLE', '无法连接图片服务。', 503)
    }
    if (!response.ok) throw providerFailure(response.status)
    const body = await response.json() as {
      data?: Array<{ url?: unknown }>
      usage?: { generated_images?: unknown; input_images?: unknown; output_tokens?: unknown; total_tokens?: unknown }
    }
    const imageURL = body.data?.[0]?.url
    if (typeof imageURL !== 'string') throw new AIImageError('IMAGE_PROVIDER_INVALID_RESPONSE', '图片服务返回格式无效。', 502)
    const image = await this.download(imageURL, current.allowedHosts)
    const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0
    return {
      image,
      usage: {
        generatedImages: number(body.usage?.generated_images),
        inputImages: number(body.usage?.input_images),
        outputTokens: number(body.usage?.output_tokens),
        totalTokens: number(body.usage?.total_tokens),
      },
    }
  }

  private async download(rawURL: string, allowedHosts: Set<string>): Promise<ProviderImage> {
    const url = new URL(rawURL)
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
      throw new AIImageError('IMAGE_DOWNLOAD_URL_REJECTED', '图片下载地址未通过安全校验。', 502)
    }
    let response: Response
    try {
      response = await this.fetchImpl(url, { method: 'GET', redirect: 'error', signal: signal(30_000) })
    } catch {
      throw new AIImageError('IMAGE_DOWNLOAD_FAILED', '候选图下载失败。', 502)
    }
    if (!response.ok) throw new AIImageError('IMAGE_DOWNLOAD_FAILED', '候选图下载失败。', 502)
    const declaredLength = Number(response.headers.get('content-length') || 0)
    if (declaredLength > 15 * 1024 * 1024) throw new AIImageError('IMAGE_TOO_LARGE', '候选图超过 15MB。', 502)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (!bytes.byteLength || bytes.byteLength > 15 * 1024 * 1024) throw new AIImageError('IMAGE_TOO_LARGE', '候选图大小无效。', 502)
    let metadata: Metadata
    try { metadata = await sharp(bytes).metadata() } catch { throw new AIImageError('IMAGE_INVALID', '候选图不是有效图片。', 502) }
    const mimeMap = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const
    const mimeType = metadata.format ? mimeMap[metadata.format as keyof typeof mimeMap] : undefined
    if (!mimeType || !metadata.width || !metadata.height) throw new AIImageError('IMAGE_INVALID', '候选图格式不受支持。', 502)
    return { bytes, height: metadata.height, mimeType, width: metadata.width }
  }
}
