import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let draftPostID: number
let coverMediaID: number

describe('public access controls', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const cover = await payload.create({
      collection: 'media',
      data: { alt: '访问控制测试文章封面', licenseNote: '项目自有测试图片。', purpose: 'thumbnail', visibility: 'public' },
      filePath: path.resolve('public/images/article-covers/default-editorial.webp'),
      overrideAccess: true,
    })
    coverMediaID = cover.id

    const draftPost = await payload.create({
      collection: 'posts',
      data: {
        title: 'Private draft for access test',
        slug: `private-draft-${Date.now()}`,
        summary: 'This draft must never be visible to anonymous visitors.',
        content: {
          root: {
            children: [
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'This is a valid draft body used to verify publish and withdrawal.',
                    type: 'text',
                    version: 1,
                  },
                ],
                direction: null,
                format: '',
                indent: 0,
                textFormat: 0,
                textStyle: '',
                type: 'paragraph',
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        },
        contentType: 'essay',
        reviewState: 'editing',
      },
      draft: true,
      overrideAccess: true,
    })
    draftPostID = draftPost.id
  })

  afterAll(async () => {
    if (draftPostID) {
      await payload.delete({
        collection: 'posts',
        id: draftPostID,
        overrideAccess: true,
      })
    }
    if (coverMediaID) await payload.delete({ collection: 'media', id: coverMediaID, overrideAccess: true })
  })

  it('does not expose users through access-controlled local API', async () => {
    await expect(
      payload.find({
        collection: 'users',
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('does not expose drafts through access-controlled local API', async () => {
    const posts = await payload.find({
      collection: 'posts',
      overrideAccess: false,
      where: {
        id: {
          equals: draftPostID,
        },
      },
    })

    expect(posts.totalDocs).toBe(0)
  })

  it('publishes and withdraws content without leaking drafts', async () => {
    await payload.update({
      collection: 'posts',
      id: draftPostID,
      data: {
        _status: 'published',
        cover: coverMediaID,
        publishedAt: new Date().toISOString(),
        reviewState: 'approved',
        seo: { description: '验证公开文章发布和撤回时不会泄漏草稿。', title: '公开访问控制测试' },
      },
      draft: false,
      overrideAccess: true,
    })

    const published = await payload.find({
      collection: 'posts',
      overrideAccess: false,
      where: { id: { equals: draftPostID } },
    })
    expect(published.totalDocs).toBe(1)

    await payload.update({
      collection: 'posts',
      id: draftPostID,
      data: { _status: 'draft' },
      draft: false,
      overrideAccess: true,
    })

    const withdrawn = await payload.find({
      collection: 'posts',
      overrideAccess: false,
      where: { id: { equals: draftPostID } },
    })
    expect(withdrawn.totalDocs).toBe(0)
  })

  it('rejects anonymous writes', async () => {
    await expect(
      payload.create({
        collection: 'posts',
        data: {
          title: 'Anonymous write',
          slug: `anonymous-write-${Date.now()}`,
          summary: 'This write should be rejected.',
          content: {
            root: {
              children: [],
              direction: null,
              format: '',
              indent: 0,
              type: 'root',
              version: 1,
            },
          },
          contentType: 'essay',
          reviewState: 'editing',
        },
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
})
