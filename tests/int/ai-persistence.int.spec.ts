import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import config from '@/payload.config'
import { getDailyUsage, saveGenerationAsDraft } from '@/modules/ai'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let userId: number | string
let generationId: number | string
let postId: number | string | undefined
let articleDirectory: string
let resourceId: number | string
let sourceMaterialId: number | string

const generatedDraft = {
  title: 'AI 生成记录测试文章',
  summary: '验证生成记录可以保存为 Payload 草稿和 Markdown 副本。',
  outline: ['背景'],
  sections: [{ id: 's1', heading: '背景', paragraphs: ['这是一段只用于集成测试的正文。'] }],
  factChecklist: [{ claim: '测试事实', status: 'verified', question: '' }],
  suggestedTags: ['测试'],
  disclosure: { aiAssisted: true },
}

describe('AI generation persistence', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    articleDirectory = await mkdtemp(path.join(tmpdir(), 'snorlaxden-articles-'))
    process.env.CONTENT_ARTICLE_DIR = articleDirectory

    const user = await payload.create({
      collection: 'users',
      data: { email: `ai-persistence-${Date.now()}@example.com`, name: 'AI Test Admin', password: 'test-password', role: 'admin' },
      overrideAccess: true,
    })
    userId = user.id
    const resource = await payload.create({
      collection: 'resources',
      data: { capturedAt: new Date().toISOString(), ingestStatus: 'text_ready', notes: '本人测试笔记。', owner: user.id, resourceType: 'note', sourceAccess: 'user_supplied_text', sourceId: `ai-persistence-resource-${Date.now()}`, title: '草稿关系测试资源', visibility: 'private' },
      overrideAccess: true,
    })
    resourceId = resource.id
    const sourceMaterial = await payload.create({
      collection: 'source-materials',
      data: { author: user.id, authorizationBasis: 'owned', authorizationNote: '本人原创测试材料。', capturedAt: new Date().toISOString(), materialType: 'typed_note', personalNotes: '本人来源材料笔记。', privacy: 'private', sourceId: `ai-persistence-material-${Date.now()}`, title: '草稿关系测试材料' },
      overrideAccess: true,
    })
    sourceMaterialId = sourceMaterial.id
    const generation = await payload.create({
      collection: 'ai-generations',
      data: {
        creator: user.id,
        provider: 'deepseek',
        model: 'deepseek-chat',
        promptVersion: 'article-writer-v1',
        currentStep: 'complete',
        retryCount: 0,
        modelCallCount: 1,
        status: 'succeeded',
        sourceHash: 'test-source-hash',
        sourceText: '这是一段用于保存草稿测试的原始素材，长度足够且不会公开。',
        request: { contentType: 'learning-note', tone: 'concise', targetLength: 800 },
        resources: [resource.id],
        result: generatedDraft,
        sourceMaterials: [sourceMaterial.id],
      },
      overrideAccess: true,
    })
    generationId = generation.id
  })

  afterAll(async () => {
    if (postId) await payload.delete({ collection: 'posts', id: postId, overrideAccess: true })
    if (generationId) await payload.delete({ collection: 'ai-generations', id: generationId, overrideAccess: true })
    if (sourceMaterialId) await payload.delete({ collection: 'source-materials', id: sourceMaterialId, overrideAccess: true })
    if (resourceId) await payload.delete({ collection: 'resources', id: resourceId, overrideAccess: true })
    if (userId) await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
    if (articleDirectory) await rm(articleDirectory, { recursive: true, force: true })
    delete process.env.CONTENT_ARTICLE_DIR
  })

  it('counts generation records toward the daily administrator limit', async () => {
    const usage = await getDailyUsage(payload, userId)
    expect(usage.used).toBeGreaterThanOrEqual(1)
    expect(usage.limit).toBe(20)
  })

  it('saves a Payload draft and an auditable Markdown copy', async () => {
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const saved = await saveGenerationAsDraft(payload, user, { generationId, slug: 'ai-persistence-test-draft' })
    postId = saved.postId

    const post = await payload.findByID({ collection: 'posts', id: postId, draft: true, overrideAccess: true })
    expect(post._status).toBe('draft')
    expect(post.reviewState).toBe('needs_review')
    expect(post.aiDisclosure).toBe(true)
    expect(post.sourceResources?.map((value) => typeof value === 'object' ? value.id : value)).toContain(resourceId)
    expect(post.sourceMaterials?.map((value) => typeof value === 'object' ? value.id : value)).toContain(sourceMaterialId)

    const markdown = await readFile(path.join(articleDirectory, 'ai-persistence-test-draft.md'), 'utf8')
    expect(markdown).toContain('status: draft')
    expect(markdown).toContain('AI 生成记录测试文章')

    const generation = await payload.findByID({ collection: 'ai-generations', id: generationId, overrideAccess: true })
    expect(generation.status).toBe('saved_as_draft')
    expect(generation.markdownPath).toBe('content/articles/ai-persistence-test-draft.md')
  })
})
