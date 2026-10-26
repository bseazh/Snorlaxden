export const imageStylePresets = ['character-editorial', 'warm-story', 'tech-garden'] as const
export const imageAspectRatios = ['16:9', '4:3', '1:1'] as const

export type ImageStylePreset = (typeof imageStylePresets)[number]
export type ImageAspectRatio = (typeof imageAspectRatios)[number]

export type ImageGenerationInput = {
  postId: number | string
  referenceMaterialId: number | string
  visualGoal: string
  stylePreset: ImageStylePreset
  aspectRatio: ImageAspectRatio
  count: number
}

export type ImageCandidate = {
  id: string
  storageDriver: 'local' | 'cos'
  storageKey: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  byteSize: number
  sha256: string
  width: number
  height: number
  status: 'available' | 'selected'
  createdAt: string
}

export class AIImageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly generationId?: number | string,
  ) {
    super(message)
  }
}

function numericId(value: unknown, label: string) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value))) {
    throw new AIImageError('VALIDATION_ERROR', `${label}格式不正确。`)
  }
  return Number(value)
}

export function validateImageGenerationInput(value: unknown): ImageGenerationInput {
  if (!value || typeof value !== 'object') throw new AIImageError('VALIDATION_ERROR', '请求内容无效。')
  const input = value as Record<string, unknown>
  const visualGoal = typeof input.visualGoal === 'string' ? input.visualGoal.trim() : ''
  if (visualGoal.length < 4 || visualGoal.length > 800) throw new AIImageError('VALIDATION_ERROR', '视觉要求需为 4–800 个字符。')
  if (!imageStylePresets.includes(input.stylePreset as ImageStylePreset)) throw new AIImageError('VALIDATION_ERROR', '图片风格无效。')
  if (!imageAspectRatios.includes(input.aspectRatio as ImageAspectRatio)) throw new AIImageError('VALIDATION_ERROR', '图片比例无效。')
  const count = Number(input.count ?? 1)
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new AIImageError('VALIDATION_ERROR', '单次只能生成 1–4 张候选图。')
  return {
    postId: numericId(input.postId, '文章 ID'),
    referenceMaterialId: numericId(input.referenceMaterialId, '参考材料 ID'),
    visualGoal,
    stylePreset: input.stylePreset as ImageStylePreset,
    aspectRatio: input.aspectRatio as ImageAspectRatio,
    count,
  }
}

export function parseCandidates(value: unknown): ImageCandidate[] {
  if (!Array.isArray(value)) return []
  return value.filter((candidate): candidate is ImageCandidate => Boolean(
    candidate && typeof candidate === 'object' && typeof candidate.id === 'string' &&
    typeof candidate.storageKey === 'string' && typeof candidate.sha256 === 'string',
  ))
}

