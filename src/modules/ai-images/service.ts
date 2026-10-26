import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import sharp from 'sharp'
import type { Payload } from 'payload'

import type { AiImageGeneration, SourceMaterial, User } from '@/payload-types'

import { writeAuditLog, type AuditRequestContext } from '../audit'
import { getPrivateStorage } from '../source-materials'
import { AIImageError, type ImageCandidate, type ImageGenerationInput, parseCandidates } from './domain'
import { buildArticleCoverPrompt, articleCoverPromptVersion } from './prompts/article-cover-character-v1'
import { SophnetImageProvider, type ProviderUsage } from './provider'
import { checksum, getImageCandidateStorage } from './storage'

const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000
const ALLOWED_REFERENCE_TYPES = new Set(['owned_image', 'authorized_original'])
const ALLOWED_AUTHORIZATION = new Set(['owned', 'permission', 'open_license', 'public_domain'])

function relationId(value: unknown): number | string | undefined {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: number | string }).id
  return undefined
}

function dailyLimit() {
  const parsed = Number(process.env.AI_IMAGE_DAILY_LIMIT || 8)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 8
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export function getImageProviderAvailability() {
  const provider = new SophnetImageProvider()
  return { enabled: provider.isConfigured(), provider: 'sophnet' as const, model: provider.model }
}

export async function getImageDailyUsage(payload: Payload, userId: number | string) {
  const records = await payload.find({
    collection: 'ai-image-generations',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    pagination: false,
    where: { and: [{ creator: { equals: userId } }, { createdAt: { greater_than_equal: startOfToday() } }] },
  })
  const used = records.docs.reduce((total, record) => total + Number(record.generationCallCount || 0), 0)
  const limit = dailyLimit()
  return { limit, remaining: Math.max(0, limit - used), used }
}

export async function listImageStudioSources(payload: Payload, userId: number | string) {
  const [posts, materials] = await Promise.all([
    payload.find({
      collection: 'posts', depth: 0, limit: 100, overrideAccess: true, sort: '-updatedAt',
      where: { and: [{ _status: { equals: 'draft' } }, { author: { equals: userId } }] },
    }),
    payload.find({
      collection: 'source-materials', depth: 0, limit: 100, overrideAccess: true, sort: '-createdAt',
      where: {
        and: [
          { author: { equals: userId } },
          { materialType: { in: ['owned_image', 'authorized_original'] } },
          { mimeType: { in: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] } },
        ],
      },
    }),
  ])
  return {
    posts: posts.docs.map((post) => ({ id: post.id, label: post.title, summary: post.summary })),
    references: materials.docs.filter((material) => material.storageKey && ALLOWED_AUTHORIZATION.has(material.authorizationBasis)).map((material) => ({
      authorization: material.authorizationNote,
      id: material.id,
      label: material.title,
      mimeType: material.mimeType,
    })),
  }
}

function idempotencyKey(userId: number | string, input: ImageGenerationInput, referenceChecksum: string) {
  const bucket = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS)
  return createHash('sha256').update(JSON.stringify({ bucket, input, referenceChecksum, userId, version: articleCoverPromptVersion })).digest('hex')
}

function safeGeneration(record: { id: number | string; status: string; model: string; promptVersion: string; candidates?: unknown; errorCode?: string | null; errorMessage?: string | null; selectedMedia?: unknown }) {
  return {
    candidates: parseCandidates(record.candidates).map((candidate) => ({
      byteSize: candidate.byteSize,
      height: candidate.height,
      id: candidate.id,
      mimeType: candidate.mimeType,
      previewURL: `/api/internal/ai/images/${record.id}/candidates/${candidate.id}`,
      sha256: candidate.sha256,
      status: candidate.status,
      width: candidate.width,
    })),
    errorCode: record.errorCode || undefined,
    errorMessage: record.errorMessage || undefined,
    generationId: record.id,
    model: record.model,
    promptVersion: record.promptVersion,
    selectedMediaId: relationId(record.selectedMedia),
    status: record.status,
  }
}

async function ownedDraftAndReference(payload: Payload, user: User, input: ImageGenerationInput) {
  const [post, reference] = await Promise.all([
    payload.findByID({ collection: 'posts', depth: 0, id: input.postId, overrideAccess: true }),
    payload.findByID({ collection: 'source-materials', depth: 0, id: input.referenceMaterialId, overrideAccess: true }),
  ])
  if (post._status !== 'draft' || String(relationId(post.author)) !== String(user.id)) {
    throw new AIImageError('DRAFT_NOT_ALLOWED', '只能为本人拥有的文章草稿生成封面。', 403)
  }
  if (
    String(relationId(reference.author)) !== String(user.id) || !ALLOWED_REFERENCE_TYPES.has(reference.materialType) ||
    !ALLOWED_AUTHORIZATION.has(reference.authorizationBasis) || !reference.mimeType?.startsWith('image/') ||
    !reference.storageKey || !reference.sha256
  ) {
    throw new AIImageError('REFERENCE_NOT_ALLOWED', '只能使用本人拥有或明确获授权的私有图片材料。', 403)
  }
  return { post, reference }
}

function sumUsage(left: ProviderUsage | undefined, right: ProviderUsage): ProviderUsage {
  return {
    generatedImages: (left?.generatedImages || 0) + right.generatedImages,
    inputImages: (left?.inputImages || 0) + right.inputImages,
    outputTokens: (left?.outputTokens || 0) + right.outputTokens,
    totalTokens: (left?.totalTokens || 0) + right.totalTokens,
  }
}

async function executeCalls(input: {
  payload: Payload
  user: User
  generation: AiImageGeneration
  reference: SourceMaterial
  callCount: number
  request: AuditRequestContext
}) {
  const { payload, user, generation, reference, callCount, request } = input
  const provider = new SophnetImageProvider()
  const referenceBytes = await getPrivateStorage(reference.storageDriver).read(reference.storageKey as string)
  const candidates = parseCandidates(generation.candidates)
  let usage = generation.usage as ProviderUsage | undefined
  let calls = Number(generation.generationCallCount || 0)
  let lastError: AIImageError | undefined

  for (let index = 0; index < callCount; index += 1) {
    calls += 1
    await payload.update({ collection: 'ai-image-generations', id: generation.id, data: { generationCallCount: calls, status: 'running' }, overrideAccess: true })
    try {
      const output = await provider.generate({ prompt: generation.prompt as string, referenceBytes, referenceMimeType: reference.mimeType as string })
      const sha256 = checksum(output.image.bytes)
      if (!candidates.some((candidate) => candidate.sha256 === sha256)) {
        const storage = getImageCandidateStorage()
        const storageKey = await storage.put({ bytes: output.image.bytes, generationId: generation.id, mimeType: output.image.mimeType, sha256 })
        candidates.push({
          byteSize: output.image.bytes.byteLength,
          createdAt: new Date().toISOString(),
          height: output.image.height,
          id: randomUUID(),
          mimeType: output.image.mimeType,
          sha256,
          status: 'available',
          storageDriver: storage.driver,
          storageKey,
          width: output.image.width,
        })
      }
      usage = sumUsage(usage, output.usage)
      await payload.update({ collection: 'ai-image-generations', id: generation.id, data: { candidates, generationCallCount: calls, usage }, overrideAccess: true })
    } catch (error) {
      lastError = error instanceof AIImageError ? error : new AIImageError('IMAGE_GENERATION_FAILED', '图片生成失败。', 500)
      break
    }
  }

  const status = candidates.length === Number(generation.requestedCount) ? 'succeeded' : candidates.length > 0 ? 'partially_succeeded' : 'failed'
  const updated = await payload.update({
    collection: 'ai-image-generations', id: generation.id, overrideAccess: true,
    data: { candidates, errorCode: lastError?.code || null, errorMessage: lastError?.message || null, generationCallCount: calls, status, usage },
  })
  await writeAuditLog(payload, {
    action: status === 'failed' ? 'ai-image.generation_failed' : 'ai-image.generation_completed',
    actorId: user.id,
    metadata: { candidateCount: candidates.length, errorCode: lastError?.code, model: generation.model, promptVersion: generation.promptVersion, provider: 'sophnet' },
    outcome: status === 'failed' ? 'failure' : 'success', request, resourceId: generation.id, resourceType: 'ai-image-generation',
  })
  if (status === 'failed') throw new AIImageError(lastError?.code || 'IMAGE_GENERATION_FAILED', lastError?.message || '图片生成失败。', lastError?.status || 500, generation.id)
  return safeGeneration(updated)
}

export async function generateArticleCover(payload: Payload, user: User, input: ImageGenerationInput, request: AuditRequestContext) {
  const availability = getImageProviderAvailability()
  if (!availability.enabled) throw new AIImageError('IMAGE_PROVIDER_DISABLED', 'AI 图片功能尚未启用。', 503)
  const { post, reference } = await ownedDraftAndReference(payload, user, input)
  const key = idempotencyKey(user.id, input, reference.sha256 as string)
  const existing = await payload.find({ collection: 'ai-image-generations', depth: 0, limit: 1, overrideAccess: true, where: { idempotencyKey: { equals: key } } })
  if (existing.totalDocs) {
    await writeAuditLog(payload, { action: 'ai-image.idempotent_replay', actorId: user.id, metadata: { promptVersion: articleCoverPromptVersion }, request, resourceId: existing.docs[0].id, resourceType: 'ai-image-generation' })
    return safeGeneration(existing.docs[0])
  }
  const usage = await getImageDailyUsage(payload, user.id)
  if (input.count > usage.remaining) throw new AIImageError('IMAGE_DAILY_LIMIT_REACHED', `今日图片调用剩余 ${usage.remaining} 次。`, 429)
  const prompt = buildArticleCoverPrompt({ aspectRatio: input.aspectRatio, stylePreset: input.stylePreset, summary: post.summary, title: post.title, visualGoal: input.visualGoal })
  const generation = await payload.create({
    collection: 'ai-image-generations', overrideAccess: true,
    data: {
      creator: user.id, generationCallCount: 0, idempotencyKey: key, model: availability.model, post: post.id,
      prompt, promptVersion: articleCoverPromptVersion, provider: 'sophnet', referenceMaterial: reference.id,
      request: { aspectRatio: input.aspectRatio, stylePreset: input.stylePreset, visualGoal: input.visualGoal },
      requestedCount: input.count, retryCount: 0, status: 'queued',
    },
  })
  await writeAuditLog(payload, { action: 'ai-image.queued', actorId: user.id, metadata: { count: input.count, promptVersion: articleCoverPromptVersion, provider: 'sophnet' }, request, resourceId: generation.id, resourceType: 'ai-image-generation' })
  return executeCalls({ callCount: input.count, generation, payload, reference, request, user })
}

export async function retryImageGeneration(payload: Payload, user: User, id: number | string, request: AuditRequestContext) {
  const generation = await payload.findByID({ collection: 'ai-image-generations', depth: 0, id, overrideAccess: true })
  if (String(relationId(generation.creator)) !== String(user.id)) throw new AIImageError('FORBIDDEN', '无权重试此任务。', 403)
  if (!['failed', 'partially_succeeded'].includes(generation.status)) throw new AIImageError('RETRY_NOT_ALLOWED', '当前任务状态不能重试。', 409)
  if (Number(generation.retryCount || 0) >= 2) throw new AIImageError('RETRY_LIMIT_REACHED', '此任务已达到重试上限。', 409)
  const remaining = Number(generation.requestedCount) - parseCandidates(generation.candidates).length
  const usage = await getImageDailyUsage(payload, user.id)
  if (remaining > usage.remaining) throw new AIImageError('IMAGE_DAILY_LIMIT_REACHED', `今日图片调用剩余 ${usage.remaining} 次。`, 429)
  const reference = await payload.findByID({ collection: 'source-materials', depth: 0, id: relationId(generation.referenceMaterial)!, overrideAccess: true })
  await payload.update({ collection: 'ai-image-generations', id, data: { retryCount: Number(generation.retryCount || 0) + 1, status: 'queued' }, overrideAccess: true })
  await writeAuditLog(payload, { action: 'ai-image.retry', actorId: user.id, metadata: { remaining }, request, resourceId: id, resourceType: 'ai-image-generation' })
  return executeCalls({ callCount: remaining, generation: { ...generation, retryCount: Number(generation.retryCount || 0) + 1 }, payload, reference, request, user })
}

async function ownedGeneration(payload: Payload, user: User, id: number | string) {
  const generation = await payload.findByID({ collection: 'ai-image-generations', depth: 0, id, overrideAccess: true })
  if (String(relationId(generation.creator)) !== String(user.id)) throw new AIImageError('FORBIDDEN', '无权访问此图片任务。', 403)
  return generation
}

export async function readCandidate(payload: Payload, user: User, generationId: number | string, candidateId: string, request: AuditRequestContext) {
  const generation = await ownedGeneration(payload, user, generationId)
  const candidate = parseCandidates(generation.candidates).find((item) => item.id === candidateId)
  if (!candidate) throw new AIImageError('IMAGE_NOT_FOUND', '候选图不存在。', 404)
  const bytes = await getImageCandidateStorage(candidate.storageDriver).read(candidate.storageKey)
  await writeAuditLog(payload, { action: 'ai-image.previewed', actorId: user.id, metadata: { byteSize: candidate.byteSize }, request, resourceId: generation.id, resourceType: 'ai-image-generation' })
  return { bytes, candidate }
}

export async function deleteCandidate(payload: Payload, user: User, generationId: number | string, candidateId: string, request: AuditRequestContext) {
  const generation = await ownedGeneration(payload, user, generationId)
  const candidates = parseCandidates(generation.candidates)
  const candidate = candidates.find((item) => item.id === candidateId)
  if (!candidate) throw new AIImageError('IMAGE_NOT_FOUND', '候选图不存在。', 404)
  if (candidate.status === 'selected') throw new AIImageError('SELECTED_IMAGE_DELETE_DENIED', '已选用图片不能从候选区删除。', 409)
  await getImageCandidateStorage(candidate.storageDriver).delete(candidate.storageKey)
  await payload.update({ collection: 'ai-image-generations', id: generationId, data: { candidates: candidates.filter((item) => item.id !== candidateId) }, overrideAccess: true })
  await writeAuditLog(payload, { action: 'ai-image.candidate_deleted', actorId: user.id, request, resourceId: generation.id, resourceType: 'ai-image-generation' })
  return { deleted: true }
}

export async function selectCandidate(payload: Payload, user: User, generationId: number | string, candidateId: string, request: AuditRequestContext) {
  const generation = await ownedGeneration(payload, user, generationId)
  if (generation.selectedMedia) throw new AIImageError('IMAGE_ALREADY_SELECTED', '此任务已经选用过图片。', 409)
  const candidates = parseCandidates(generation.candidates)
  const candidate = candidates.find((item) => item.id === candidateId)
  if (!candidate) throw new AIImageError('IMAGE_NOT_FOUND', '候选图不存在。', 404)
  const post = await payload.findByID({ collection: 'posts', depth: 0, id: relationId(generation.post)!, overrideAccess: true })
  if (post._status !== 'draft' || String(relationId(post.author)) !== String(user.id)) throw new AIImageError('DRAFT_NOT_ALLOWED', '只能把图片绑定到本人文章草稿。', 403)
  const sourceBytes = await getImageCandidateStorage(candidate.storageDriver).read(candidate.storageKey)
  const optimized = await sharp(sourceBytes).rotate().jpeg({ mozjpeg: true, quality: 88 }).toBuffer()
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'snorlaxden-ai-media-'))
  const temporaryPath = path.join(temporaryDirectory, `ai-cover-${generation.id}-${candidateId}.jpg`)
  await writeFile(temporaryPath, optimized, { mode: 0o600 })
  let media
  try {
    media = await payload.create({
      collection: 'media', overrideAccess: true,
      data: {
        aiGenerated: true, aiModel: generation.model, aiPromptVersion: generation.promptVersion, aiProvider: generation.provider,
        alt: `${post.title}的 AI 辅助生成封面`, licenseNote: '由站长拥有或明确授权的人物参考资产辅助生成，发布前经人工选择。',
        purpose: 'ai_image', sha256: checksum(optimized), sourceImageGeneration: generation.id, visibility: 'private',
      },
      filePath: temporaryPath,
    })
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
  try {
    await payload.update({ collection: 'posts', draft: true, id: post.id, overrideAccess: true, data: { cover: media.id, aiDisclosure: true } })
    const updatedCandidates: ImageCandidate[] = candidates.map((item) => item.id === candidateId ? { ...item, status: 'selected' } : item)
    await payload.update({ collection: 'ai-image-generations', id: generation.id, overrideAccess: true, data: { candidates: updatedCandidates, selectedCandidateId: candidateId, selectedMedia: media.id, status: 'selected' } })
  } catch (error) {
    await payload.delete({ collection: 'media', id: media.id, overrideAccess: true }).catch(() => undefined)
    throw error
  }
  await writeAuditLog(payload, { action: 'ai-image.selected_and_bound', actorId: user.id, metadata: { mediaId: media.id, postId: post.id }, request, resourceId: generation.id, resourceType: 'ai-image-generation' })
  return { mediaId: media.id, postId: post.id, status: 'selected' as const }
}
