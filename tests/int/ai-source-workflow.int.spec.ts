import config from '@/payload.config'
import { AIError, createSourceWorkflow, listWorkflowSources, retrySourceWorkflow } from '@/modules/ai'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let userId: number
let otherUserId: number
let allowedResourceId: number
let blockedResourceId: number
let otherResourceId: number
let ownedMaterialId: number
let otherMaterialId: number
let succeededGenerationId: number
let retriedGenerationId: number | string | undefined

const factPackage = JSON.stringify({
  facts: [{ claim: '这是一条已从个人笔记提取的事实。', evidenceRefs: ['M:manual'] }],
  missingInformation: [],
  reviewItems: ['需要管理员核对表述。'],
  allowedSources: [{ ref: 'M:manual', label: '管理员本次补充', authorization: '个人笔记' }],
})
const generatedDraft = JSON.stringify({
  title: '可恢复工作流测试', summary: '验证事实步骤成功后，重试只执行文章草稿步骤。', outline: ['背景'],
  sections: [{ id: 'background', heading: '背景', paragraphs: ['这是用于集成测试的文章正文。'] }],
  factChecklist: [{ claim: '这是一条已从个人笔记提取的事实。', status: 'verified', question: '' }],
  suggestedTags: ['测试'], disclosure: { aiAssisted: true },
})

describe('AI source workflow authorization', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const stamp = Date.now()
    const user = await payload.create({ collection: 'users', data: { email: `workflow-${stamp}@example.com`, name: 'Workflow Admin', password: 'test-password', role: 'admin' }, overrideAccess: true })
    const other = await payload.create({ collection: 'users', data: { email: `workflow-other-${stamp}@example.com`, name: 'Other Admin', password: 'test-password', role: 'admin' }, overrideAccess: true })
    userId = user.id; otherUserId = other.id
    const allowed = await payload.create({ collection: 'resources', data: { capturedAt: new Date().toISOString(), ingestStatus: 'text_ready', notes: '这是本人提供的活动笔记，可以用于生成内容。', owner: user.id, resourceType: 'note', sourceAccess: 'user_supplied_text', sourceId: `workflow-r-${stamp}`, title: '合法个人笔记', visibility: 'private' }, overrideAccess: true })
    const blocked = await payload.create({ collection: 'resources', data: { capturedAt: new Date().toISOString(), ingestStatus: 'saved_only', notes: '即使误填了笔记，仅 URL 来源也不允许进入模型。', owner: user.id, resourceType: 'link', sourceAccess: 'url_only', sourceId: `workflow-blocked-${stamp}`, title: '仅 URL 来源', visibility: 'private' }, overrideAccess: true })
    const otherResource = await payload.create({ collection: 'resources', data: { capturedAt: new Date().toISOString(), ingestStatus: 'text_ready', notes: '这是其他管理员拥有的个人笔记。', owner: other.id, resourceType: 'note', sourceAccess: 'user_supplied_text', sourceId: `workflow-other-r-${stamp}`, title: '其他管理员资源', visibility: 'private' }, overrideAccess: true })
    allowedResourceId = allowed.id; blockedResourceId = blocked.id; otherResourceId = otherResource.id
    const owned = await payload.create({ collection: 'source-materials', data: { author: user.id, authorizationBasis: 'owned', authorizationNote: '本人原创。', capturedAt: new Date().toISOString(), materialType: 'typed_note', personalNotes: '本人整理的研究笔记。', privacy: 'private', sourceId: `workflow-s-${stamp}`, title: '本人来源材料' }, overrideAccess: true })
    const foreign = await payload.create({ collection: 'source-materials', data: { author: other.id, authorizationBasis: 'owned', authorizationNote: '其他管理员原创。', capturedAt: new Date().toISOString(), materialType: 'typed_note', personalNotes: '不属于当前管理员的私有文字。', privacy: 'private', sourceId: `workflow-foreign-${stamp}`, title: '其他管理员来源材料' }, overrideAccess: true })
    ownedMaterialId = owned.id; otherMaterialId = foreign.id
    const generation = await payload.create({ collection: 'ai-generations', data: { creator: user.id, currentStep: 'complete', model: 'deepseek-chat', modelCallCount: 2, promptVersion: 'source-workflow-v1', provider: 'deepseek', request: {}, retryCount: 0, sourceHash: `workflow-${stamp}`, sourceText: '已完成的来源工作流任务。', status: 'succeeded' }, overrideAccess: true })
    succeededGenerationId = generation.id
  })

  afterAll(async () => {
    if (retriedGenerationId) await payload.delete({ collection: 'ai-generations', id: retriedGenerationId, overrideAccess: true })
    if (succeededGenerationId) await payload.delete({ collection: 'ai-generations', id: succeededGenerationId, overrideAccess: true })
    for (const id of [ownedMaterialId, otherMaterialId]) if (id) await payload.delete({ collection: 'source-materials', id, overrideAccess: true })
    for (const id of [allowedResourceId, blockedResourceId, otherResourceId]) if (id) await payload.delete({ collection: 'resources', id, overrideAccess: true })
    for (const id of [userId, otherUserId]) if (id) await payload.delete({ collection: 'users', id, overrideAccess: true })
  })

  it('lists only text-ready resources and source materials owned by the current administrator', async () => {
    const sources = await listWorkflowSources(payload, userId)
    expect(sources.resources.map((item) => item.id)).toContain(allowedResourceId)
    expect(sources.resources.map((item) => item.id)).not.toContain(blockedResourceId)
    expect(sources.resources.map((item) => item.id)).not.toContain(otherResourceId)
    expect(sources.sourceMaterials.map((item) => item.id)).toContain(ownedMaterialId)
    expect(sources.sourceMaterials.map((item) => item.id)).not.toContain(otherMaterialId)
  })

  it('does not retry a completed workflow or consume another model call', async () => {
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    await expect(retrySourceWorkflow(payload, user, succeededGenerationId)).rejects.toMatchObject({ code: 'TASK_NOT_RETRYABLE' })
    const generation = await payload.findByID({ collection: 'ai-generations', id: succeededGenerationId, overrideAccess: true })
    expect(generation.modelCallCount).toBe(2)
  })

  it('retries from draft without repeating a successful fact-package call', async () => {
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const calls: string[] = []
    const firstCompletion = async (_config: never, messages: Array<{ content: string }>) => {
      calls.push(messages[0]?.content || '')
      if (calls.length === 1) return factPackage
      throw new AIError('GENERATION_FAILED', '模拟文章草稿步骤失败。', 502)
    }
    await expect(createSourceWorkflow(payload, user, {
      contentType: 'learning-note', manualText: '这是本人整理且允许用于生成内容的测试笔记，长度满足工作流要求。', provider: 'deepseek',
      resourceIds: [], sourceMaterialIds: [], targetLength: 800, tone: 'concise', verifiedFacts: '',
    }, undefined, { complete: firstCompletion as never })).rejects.toMatchObject({ stage: 'draft' })

    const failed = await payload.find({ collection: 'ai-generations', limit: 1, overrideAccess: true, sort: '-createdAt', where: { creator: { equals: userId }, promptVersion: { equals: 'source-workflow-v1' }, status: { equals: 'failed' } } })
    retriedGenerationId = failed.docs[0]?.id
    expect(retriedGenerationId).toBeTruthy()
    expect(failed.docs[0]?.factPackage).toBeTruthy()
    expect(failed.docs[0]?.modelCallCount).toBe(2)

    const retryCalls: string[] = []
    const result = await retrySourceWorkflow(payload, user, retriedGenerationId!, undefined, { complete: (async (_config: never, messages: Array<{ content: string }>) => {
      retryCalls.push(messages[0]?.content || '')
      return generatedDraft
    }) as never })
    expect(result.draft.title).toBe('可恢复工作流测试')
    expect(calls).toHaveLength(2)
    expect(retryCalls).toHaveLength(1)
    const retried = await payload.findByID({ collection: 'ai-generations', id: retriedGenerationId!, overrideAccess: true })
    expect(retried.modelCallCount).toBe(3)
    expect(retried.retryCount).toBe(1)
    expect(retried.status).toBe('succeeded')
  })
})
