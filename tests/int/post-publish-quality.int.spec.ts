import path from 'node:path'

import config from '@/payload.config'
import type { Post } from '@/payload-types'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let draftID: number
let validMediaID: number
let incompleteAIMediaID: number

const content: Post['content'] = {
  root: {
    children: [{ children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: '发布质量门禁测试正文。', type: 'text', version: 1 }], direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', type: 'paragraph', version: 1 }],
    direction: null, format: '', indent: 0, type: 'root', version: 1,
  },
} as Post['content']

describe('post publication quality gate', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const stamp = Date.now()
    const source = path.resolve('public/images/article-covers/default-editorial.webp')
    const validMedia = await payload.create({
      collection: 'media', overrideAccess: true, filePath: source,
      data: { alt: '测试文章的正式封面', licenseNote: '项目自有测试图片，仅用于自动化验证。', purpose: 'thumbnail', visibility: 'public' },
    })
    validMediaID = validMedia.id
    const incompleteAI = await payload.create({
      collection: 'media', overrideAccess: true, filePath: source,
      data: { aiGenerated: true, alt: '元数据不完整的 AI 封面', licenseNote: '测试用途。', purpose: 'ai_image', visibility: 'public' },
    })
    incompleteAIMediaID = incompleteAI.id
    const draft = await payload.create({
      collection: 'posts', draft: true, overrideAccess: true,
      data: { content, contentType: 'knowledge', reviewState: 'editing', slug: `publish-gate-${stamp}`, summary: '草稿允许暂时缺少封面和 SEO 字段。', title: '发布质量门禁测试' },
    })
    draftID = draft.id
  })

  afterAll(async () => {
    if (draftID) await payload.delete({ collection: 'posts', id: draftID, overrideAccess: true }).catch(() => undefined)
    if (incompleteAIMediaID) await payload.delete({ collection: 'media', id: incompleteAIMediaID, overrideAccess: true }).catch(() => undefined)
    if (validMediaID) await payload.delete({ collection: 'media', id: validMediaID, overrideAccess: true }).catch(() => undefined)
  })

  it('allows an incomplete draft but rejects an incomplete publication', async () => {
    const draft = await payload.findByID({ collection: 'posts', draft: true, id: draftID, overrideAccess: true })
    expect(draft._status).toBe('draft')
    await expect(payload.update({ collection: 'posts', id: draftID, data: { _status: 'published' }, draft: false, overrideAccess: true }))
      .rejects.toMatchObject({ status: 400 })
  })

  it('rejects an AI cover whose provenance metadata is incomplete', async () => {
    await expect(payload.update({
      collection: 'posts', id: draftID, draft: false, overrideAccess: true,
      data: { _status: 'published', cover: incompleteAIMediaID, seo: { description: '完整 SEO 描述', title: '完整 SEO 标题' } },
    })).rejects.toMatchObject({ status: 400 })
  })

  it('publishes when cover licensing, visibility, alt text and SEO are complete', async () => {
    const published = await payload.update({
      collection: 'posts', id: draftID, draft: false, overrideAccess: true,
      data: { _status: 'published', cover: validMediaID, publishedAt: new Date().toISOString(), reviewState: 'approved', seo: { description: '完整 SEO 描述', title: '完整 SEO 标题' } },
    })
    expect(published._status).toBe('published')
  })
})
