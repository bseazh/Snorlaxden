import { rm } from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'

import config from '@payload-config'
import { createSourceWorkflow, saveGenerationAsDraft } from '@/modules/ai'

const payload = await getPayload({ config })
const stamp = Date.now()
const slug = `issue014-smoke-${stamp}`
let resourceId: number | string | undefined
let generationId: number | string | undefined
let postId: number | string | undefined

try {
  const users = await payload.find({ collection: 'users', limit: 1, overrideAccess: true, sort: 'createdAt' })
  const user = users.docs[0]
  if (!user) throw new Error('Production smoke requires an existing administrator.')

  const resource = await payload.create({
    collection: 'resources',
    context: { skipAudit: true },
    data: {
      capturedAt: new Date().toISOString(), ingestStatus: 'text_ready',
      notes: '本人正在验证来源材料驱动的内容生产流程。该流程先整理事实，再生成草稿，并且只允许人工发布。',
      owner: user.id, resourceType: 'note', sourceAccess: 'user_supplied_text',
      sourceId: crypto.randomUUID(), title: 'ISSUE-014 生产验收临时笔记', visibility: 'private',
    },
    overrideAccess: true,
  })
  resourceId = resource.id

  const result = await createSourceWorkflow(payload, user, {
    contentType: 'learning-note', manualText: '', provider: 'deepseek', resourceIds: [Number(resource.id)],
    sourceMaterialIds: [], targetLength: 500, tone: 'concise', verifiedFacts: '该功能只保存草稿，不自动发布。',
  })
  generationId = result.generationId
  if (!result.factPackage?.facts.length) throw new Error('Fact package is empty.')

  const saved = await saveGenerationAsDraft(payload, user, { generationId, slug })
  postId = saved.postId
  const post = await payload.findByID({ collection: 'posts', draft: true, id: postId, overrideAccess: true })
  const sourceIds = (post.sourceResources || []).map((value) => typeof value === 'object' ? value.id : value)
  if (post._status !== 'draft' || !sourceIds.some((id) => String(id) === String(resource.id))) {
    throw new Error('Draft status or source relationship verification failed.')
  }
  payload.logger.info({ factCount: result.factPackage.facts.length, modelCallCount: 2, msg: 'ISSUE014_PRODUCTION_SMOKE_OK' })
} finally {
  if (postId) await payload.delete({ collection: 'posts', context: { skipAudit: true }, id: postId, overrideAccess: true }).catch(() => undefined)
  if (generationId) await payload.delete({ collection: 'ai-generations', context: { skipAudit: true }, id: generationId, overrideAccess: true }).catch(() => undefined)
  if (resourceId) await payload.delete({ collection: 'resources', context: { skipAudit: true }, id: resourceId, overrideAccess: true }).catch(() => undefined)
  const articleDirectory = process.env.CONTENT_ARTICLE_DIR || 'content/articles'
  await rm(path.resolve(articleDirectory, `${slug}.md`), { force: true }).catch(() => undefined)
}

process.exit(0)
