import config from '@/payload.config'
import type { Post } from '@/payload-types'
import { answerPublicQuestion, getPublicKnowledge, PublicAssistantError } from '@/modules/public-assistant'
import { getAuditRequestDetails } from '@/modules/audit'
import { getPayload, type Payload } from 'payload'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

let payload: Payload
let draftPostId: number | string
let publicPostId: number
let coverMediaId: number
const stamp = Date.now()
const draftMarker = `PRIVATE-DRAFT-${stamp}`
const publicMarker = `PUBLIC-POST-${stamp}`
const requestHeaders = new Headers({ 'x-forwarded-for': `192.0.2.${stamp % 200 + 1}`, 'x-request-id': `public-assistant-${stamp}` })
const previousEnvironment = {
  enabled: process.env.PUBLIC_AI_ENABLED,
  key: process.env.DEEPSEEK_API_KEY,
  limit: process.env.PUBLIC_AI_DAILY_LIMIT,
}

function richText(text: string): Post['content'] {
  return { root: { children: [{ children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }], direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', type: 'paragraph', version: 1 }], direction: null, format: '', indent: 0, type: 'root', version: 1 } } as Post['content']
}

describe('public AI assistant', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    process.env.PUBLIC_AI_ENABLED = 'true'
    process.env.PUBLIC_AI_DAILY_LIMIT = '1'
    process.env.DEEPSEEK_API_KEY = 'test-key'

    const cover = await payload.create({
      collection: 'media', context: { skipAudit: true }, overrideAccess: true,
      data: { alt: '公开助手测试文章封面', licenseNote: '项目自有测试图片。', purpose: 'thumbnail', visibility: 'public' },
      filePath: path.resolve('public/images/article-covers/default-editorial.webp'),
    })
    coverMediaId = cover.id

    const publicPost = await payload.create({
      collection: 'posts',
      context: { skipAudit: true },
      data: { _status: 'published', content: richText(publicMarker), contentType: 'essay', cover: coverMediaId, reviewState: 'approved', seo: { description: publicMarker, title: publicMarker }, slug: `public-assistant-public-${stamp}`, summary: publicMarker, title: publicMarker },
      draft: false,
      overrideAccess: true,
    })
    publicPostId = publicPost.id
    const draftPost = await payload.create({
      collection: 'posts',
      context: { skipAudit: true },
      data: { content: richText(draftMarker), contentType: 'essay', reviewState: 'editing', slug: `public-assistant-draft-${stamp}`, summary: draftMarker, title: draftMarker },
      draft: true,
      overrideAccess: true,
    })
    draftPostId = draftPost.id
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    const { ipHash } = getAuditRequestDetails({ headers: requestHeaders })
    const logs = await payload.find({ collection: 'audit-logs', limit: 100, overrideAccess: true, where: { ipHash: { equals: ipHash } } })
    for (const log of logs.docs) await payload.delete({ collection: 'audit-logs', context: { skipAudit: true }, id: log.id, overrideAccess: true })
    if (draftPostId) await payload.delete({ collection: 'posts', context: { skipAudit: true }, id: draftPostId, overrideAccess: true })
    if (publicPostId) await payload.delete({ collection: 'posts', context: { skipAudit: true }, id: publicPostId, overrideAccess: true })
    if (coverMediaId) await payload.delete({ collection: 'media', context: { skipAudit: true }, id: coverMediaId, overrideAccess: true })
    process.env.PUBLIC_AI_ENABLED = previousEnvironment.enabled
    process.env.PUBLIC_AI_DAILY_LIMIT = previousEnvironment.limit
    process.env.DEEPSEEK_API_KEY = previousEnvironment.key
  })

  it('builds knowledge from published content without exposing drafts', async () => {
    const knowledge = await getPublicKnowledge(payload)
    const serialized = JSON.stringify(knowledge)
    expect(serialized).toContain(publicMarker)
    expect(serialized).not.toContain(draftMarker)
  })

  it('answers with an allow-listed citation, redacted audit data, and a visitor limit', async () => {
    const modelFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ answer: '这是来自公开文章的回答。', citationIds: [`post-${publicPostId}`] }) } }],
    }), { headers: { 'Content-Type': 'application/json' }, status: 200 }))

    const result = await answerPublicQuestion(payload, '这篇公开文章讲了什么？', requestHeaders)
    expect(result.answer).toContain('公开文章')
    expect(result.citations).toEqual(expect.arrayContaining([expect.objectContaining({ id: `post-${publicPostId}` })]))
    expect(result.usage.remaining).toBe(0)

    const providerRequest = JSON.parse(String(modelFetch.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> }
    expect(JSON.stringify(providerRequest.messages)).toContain(publicMarker)
    expect(JSON.stringify(providerRequest.messages)).not.toContain(draftMarker)

    const logs = await payload.find({ collection: 'audit-logs', overrideAccess: true, where: { and: [{ requestId: { equals: `public-assistant-${stamp}` } }, { action: { contains: 'public-assistant.question' } }] } })
    expect(logs.docs.map((log) => log.action)).toEqual(expect.arrayContaining(['public-assistant.question.started', 'public-assistant.question.succeeded']))
    expect(JSON.stringify(logs.docs)).not.toContain('这篇公开文章讲了什么')

    await expect(answerPublicQuestion(payload, '请再回答一次。', requestHeaders)).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 } satisfies Partial<PublicAssistantError>)
    expect(modelFetch).toHaveBeenCalledTimes(1)
  })
})
