import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let draftPostID: number | string

describe('public access controls', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

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
        publishedAt: new Date().toISOString(),
        reviewState: 'approved',
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
