import type { Payload, PayloadRequest } from 'payload'

import { generatedDraftToMarkdown, generatedDraftToRichText, writeArticleMarkdown } from '@/modules/content/article-drafts'
import { type AuditRequestContext, writeAuditLog } from '@/modules/audit'

import { AIError } from '../domain/types'
import { readGeneratedDraft } from './generation-service'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function relationId(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: number | string }).id
  return null
}

function relationIds(values: unknown[] | null | undefined) {
  return (values || []).map(relationId).filter((id): id is number => typeof id === 'number')
}

function mapContentType(value: unknown): 'reflection' | 'knowledge' | 'project-note' | 'essay' {
  if (value === 'event-reflection') return 'reflection'
  if (value === 'learning-note' || value === 'book-review') return 'knowledge'
  if (value === 'project-case') return 'project-note'
  return 'essay'
}

export async function saveGenerationAsDraft(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  input: { generationId: number | string; slug: string },
  request?: AuditRequestContext,
) {
  try {
    const saved = await saveGenerationAsDraftCore(payload, user, input)
    await writeAuditLog(payload, {
      action: 'ai.draft.saved',
      actorId: user.id,
      metadata: { slug: saved.slug, status: saved.status },
      request,
      resourceId: saved.postId,
      resourceType: 'post',
    })
    return saved
  } catch (error) {
    await writeAuditLog(payload, {
      action: 'ai.draft.save_failed',
      actorId: user.id,
      metadata: { errorCode: error instanceof AIError ? error.code : 'DRAFT_SAVE_FAILED' },
      outcome: 'failure',
      request,
      resourceId: input.generationId,
      resourceType: 'ai-generation',
    })
    throw error
  }
}

async function saveGenerationAsDraftCore(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  input: { generationId: number | string; slug: string },
) {
  const slug = input.slug.trim().toLowerCase()
  if (!slugPattern.test(slug) || slug.length > 100) {
    throw new AIError('VALIDATION_ERROR', 'Slug 只能包含小写字母、数字和短横线，且不超过 100 个字符。', 400)
  }

  let generation
  try {
    generation = await payload.findByID({
      collection: 'ai-generations',
      id: input.generationId,
      overrideAccess: true,
    })
  } catch {
    throw new AIError('GENERATION_NOT_FOUND', '找不到这条 AI 生成记录。', 404)
  }

  if (String(relationId(generation.creator)) !== String(user.id)) {
    throw new AIError('GENERATION_NOT_FOUND', '找不到这条 AI 生成记录。', 404)
  }
  if (generation.savedPost || generation.status === 'saved_as_draft') {
    throw new AIError('DRAFT_ALREADY_SAVED', '这条生成记录已经保存为文章草稿。', 409)
  }
  if (generation.status !== 'succeeded' || !generation.result) {
    throw new AIError('VALIDATION_ERROR', '只有成功生成的内容可以保存为草稿。', 400)
  }

  const duplicate = await payload.count({
    collection: 'posts',
    overrideAccess: true,
    where: { slug: { equals: slug } },
  })
  if (duplicate.totalDocs > 0) throw new AIError('VALIDATION_ERROR', '这个 Slug 已被使用。', 409)

  const draft = readGeneratedDraft(generation.result)
  const request = generation.request && typeof generation.request === 'object'
    ? generation.request as Record<string, unknown>
    : {}
  const post = await payload.create({
    collection: 'posts',
    data: {
      title: draft.title,
      slug,
      summary: draft.summary.slice(0, 320),
      content: generatedDraftToRichText(draft),
      contentType: mapContentType(request.contentType),
      reviewState: 'needs_review',
      author: user.id,
      aiDisclosure: true,
      aiGeneration: generation.id,
      sourceResources: relationIds(generation.resources),
      sourceMaterials: relationIds(generation.sourceMaterials),
      seo: { title: draft.title, description: draft.summary.slice(0, 320) },
      _status: 'draft',
    },
    draft: true,
    overrideAccess: true,
  })

  try {
    const markdownPath = await writeArticleMarkdown(
      slug,
      generatedDraftToMarkdown(draft, { generationId: generation.id, postId: post.id, slug }),
    )
    await payload.update({
      collection: 'ai-generations',
      id: generation.id,
      data: { markdownPath, savedPost: post.id, status: 'saved_as_draft' },
      overrideAccess: true,
    })
    return { markdownPath, postId: post.id, slug, status: 'draft' as const }
  } catch (error) {
    await payload.delete({ collection: 'posts', id: post.id, overrideAccess: true })
    throw error
  }
}
