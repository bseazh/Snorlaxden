import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { generateArticleCover, selectCandidate, SophnetImageProvider } from '@/modules/ai-images'
import { LocalPrivateStorageAdapter } from '@/modules/source-materials'

let payload: Payload
let root: string
let userId: number
let postId: number
let sourceId: number
let generationId: number | string
let mediaId: number | string | undefined
let outputImage: Buffer
const originalStorageDriver = process.env.STORAGE_DRIVER
const originalStorageRoot = process.env.STORAGE_LOCAL_DIR

describe('ISSUE-010 AI image workflow (T015/T017/T019)', () => {
  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'snorlaxden-ai-images-'))
    process.env.STORAGE_DRIVER = 'local'
    process.env.STORAGE_LOCAL_DIR = root
    process.env.AI_IMAGE_ENABLED = 'true'
    process.env.AI_IMAGE_API_KEY = 'test-image-key'
    process.env.AI_IMAGE_BASE_URL = 'https://www.sophnet.com/api/open-apis/projects/easyllms/imagegenerator'
    process.env.AI_IMAGE_MODEL = 'Doubao-Seedream-5.0-pro'
    process.env.AI_IMAGE_DOWNLOAD_HOSTS = 'ark-acg-cn-beijing.tos-cn-beijing.volces.com'
    process.env.AI_IMAGE_DAILY_LIMIT = '8'
    outputImage = await sharp({ create: { background: '#d5cec8', channels: 3, height: 180, width: 320 } }).jpeg().toBuffer()

    payload = await getPayload({ config: await config })
    const stamp = Date.now()
    const user = await payload.create({ collection: 'users', data: { email: `images-${stamp}@example.com`, name: 'Image Admin', password: 'test-password', role: 'admin' }, overrideAccess: true })
    userId = user.id
    const post = await payload.create({
      collection: 'posts', draft: true, overrideAccess: true,
      data: {
        author: user.id, content: { root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 } },
        contentType: 'knowledge', reviewState: 'editing', slug: `image-draft-${stamp}`,
        summary: '验证人物参考图生成私有候选封面并由管理员选择。', title: 'AI 图片工作流测试',
      },
    })
    postId = post.id
    const referenceBytes = await sharp({ create: { background: '#6b554b', channels: 3, height: 64, width: 64 } }).png().toBuffer()
    const stored = await new LocalPrivateStorageAdapter(root).put({ buffer: referenceBytes, extension: 'png', mimeType: 'image/png' })
    const source = await payload.create({
      collection: 'source-materials', overrideAccess: true,
      data: {
        author: user.id, authorizationBasis: 'owned', authorizationNote: '本人拥有的测试人物参考图。', byteSize: referenceBytes.byteLength,
        capturedAt: new Date().toISOString(), materialType: 'owned_image', mimeType: 'image/png', originalFileName: 'character.png', privacy: 'private',
        sha256: 'a'.repeat(64), sourceId: `image-source-${stamp}`, storageDriver: 'local', storageKey: stored.key, title: '人物参考图',
      },
    })
    sourceId = source.id
  })

  afterAll(async () => {
    if (mediaId) await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true }).catch(() => undefined)
    if (generationId) await payload.delete({ collection: 'ai-image-generations', id: generationId, overrideAccess: true }).catch(() => undefined)
    if (sourceId) await payload.delete({ collection: 'source-materials', id: sourceId, overrideAccess: true }).catch(() => undefined)
    if (postId) await payload.delete({ collection: 'posts', id: postId, overrideAccess: true }).catch(() => undefined)
    if (userId) await payload.delete({ collection: 'users', id: userId, overrideAccess: true }).catch(() => undefined)
    await rm(root, { force: true, recursive: true })
    process.env.STORAGE_DRIVER = originalStorageDriver
    process.env.STORAGE_LOCAL_DIR = originalStorageRoot
    vi.unstubAllGlobals()
  })

  it('accepts a reference image, persists a private candidate, and prevents duplicate consumption', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.startsWith('https://www.sophnet.com/')) return new Response(JSON.stringify({
        data: [{ url: 'https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/private/generated.jpeg' }],
        model: 'Doubao-Seedream-5.0-Pro', usage: { generated_images: 1, input_images: 1, output_tokens: 100, total_tokens: 100 },
      }), { headers: { 'content-type': 'application/json' }, status: 200 })
      return new Response(outputImage, { headers: { 'content-length': String(outputImage.byteLength), 'content-type': 'image/jpeg' }, status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const request = { aspectRatio: '16:9' as const, count: 1, postId, referenceMaterialId: sourceId, stylePreset: 'character-editorial' as const, visualGoal: '女孩在桌前整理知识卡片' }
    const first = await generateArticleCover(payload, user, request, {})
    generationId = first.generationId
    expect(first.status).toBe('succeeded')
    expect(first.candidates).toHaveLength(1)
    expect(first.candidates[0].previewURL).toContain(`/api/internal/ai/images/${generationId}/candidates/`)

    const replay = await generateArticleCover(payload, user, request, {})
    expect(replay.generationId).toBe(generationId)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const stored = await payload.findByID({ collection: 'ai-image-generations', id: generationId, overrideAccess: true })
    expect(stored.generationCallCount).toBe(1)
    expect(JSON.stringify(stored.candidates)).toContain('private/ai-image-candidates/')
  })

  it('keeps candidates inaccessible anonymously and only binds a human-selected image to a draft', async () => {
    await expect(payload.find({ collection: 'ai-image-generations', overrideAccess: false })).rejects.toMatchObject({ status: 403 })
    const generation = await payload.findByID({ collection: 'ai-image-generations', id: generationId, overrideAccess: true })
    const candidateId = (generation.candidates as Array<{ id: string }>)[0].id
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const selected = await selectCandidate(payload, user, generationId, candidateId, {})
    mediaId = selected.mediaId
    const [post, media] = await Promise.all([
      payload.findByID({ collection: 'posts', draft: true, id: postId, overrideAccess: true }),
      payload.findByID({ collection: 'media', id: mediaId, overrideAccess: true }),
    ])
    expect(post._status).toBe('draft')
    expect(post.cover && typeof post.cover === 'object' ? post.cover.id : post.cover).toBe(mediaId)
    expect(media.visibility).toBe('private')
    expect(media.aiGenerated).toBe(true)
  })

  it('rejects provider-controlled download URLs outside the allowlist', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ url: 'https://127.0.0.1/internal.png' }] }), { status: 200 }))
    const provider = new SophnetImageProvider(fetchMock as typeof fetch)
    await expect(provider.generate({ prompt: 'safe prompt', referenceBytes: outputImage, referenceMimeType: 'image/jpeg' })).rejects.toMatchObject({ code: 'IMAGE_DOWNLOAD_URL_REJECTED' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
