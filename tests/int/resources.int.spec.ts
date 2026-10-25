import config from '@/payload.config'
import { createResource, normalizeResourceURL } from '@/modules/resources'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let req: PayloadRequest
let userId: number | string
let postId: number | string
let projectId: number | string
const resourceIds: Array<number | string> = []
const auditIds: Array<number | string> = []
const stamp = Date.now()

const richText = { root: { children: [], direction: null, format: '' as const, indent: 0, type: 'root', version: 1 } }

describe('private resource library', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const user = await payload.create({ collection: 'users', context: { skipAudit: true }, data: { email: `resource-${stamp}@example.com`, name: 'Resource Admin', password: 'test-password', role: 'admin' }, overrideAccess: true })
    userId = user.id
    req = await createLocalReq({ user }, payload)
    const post = await payload.create({ collection: 'posts', context: { skipAudit: true }, data: { content: richText, contentType: 'essay', reviewState: 'editing', slug: `resource-post-${stamp}`, summary: 'Resource relation test post.', title: 'Resource relation post' }, draft: true, overrideAccess: true })
    postId = post.id
    const project = await payload.create({ collection: 'projects', context: { skipAudit: true }, data: { content: richText, overview: 'Resource relation test project.', slug: `resource-project-${stamp}`, title: 'Resource relation project' }, draft: true, overrideAccess: true })
    projectId = project.id
  })

  afterAll(async () => {
    const logs = await payload.find({ collection: 'audit-logs', limit: 100, overrideAccess: true, where: { resourceType: { equals: 'resource' } } })
    for (const log of logs.docs) if (resourceIds.some((id) => String(id) === log.resourceId)) auditIds.push(log.id)
    for (const id of resourceIds) await payload.delete({ collection: 'resources', context: { skipAudit: true }, id, overrideAccess: true })
    for (const id of auditIds) await payload.delete({ collection: 'audit-logs', context: { skipAudit: true }, id, overrideAccess: true })
    if (postId) await payload.delete({ collection: 'posts', context: { skipAudit: true }, id: postId, overrideAccess: true })
    if (projectId) await payload.delete({ collection: 'projects', context: { skipAudit: true }, id: projectId, overrideAccess: true })
    if (userId) await payload.delete({ collection: 'users', context: { skipAudit: true }, id: userId, overrideAccess: true })
  })

  it('normalizes known platforms and rejects unsafe URLs', () => {
    expect(normalizeResourceURL('https://youtu.be/dQw4w9WgXcQ?si=tracking').canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(normalizeResourceURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=test').sourceKey).toBe('youtube:dQw4w9WgXcQ')
    expect(normalizeResourceURL('https://m.bilibili.com/video/BV1xx411c7mD?spm_id_from=333').canonicalUrl).toBe('https://www.bilibili.com/video/BV1xx411c7mD')
    expect(() => normalizeResourceURL('file:///etc/passwd')).toThrow('仅允许 http 或 https')
    expect(() => normalizeResourceURL('http://127.0.0.1/private')).toThrow('环回')
    expect(() => normalizeResourceURL('http://169.254.169.254/latest/meta-data')).toThrow('链路本地')
    expect(() => normalizeResourceURL('https://user:pass@example.com')).toThrow('账号或密码')
  })

  it('creates private-by-default resources and denies all anonymous reads and writes', async () => {
    const resource = await createResource(payload, req.user!, { resourceType: 'video', sourceUrl: `https://youtu.be/dQw4w9WgXcQ?si=${stamp}`, title: 'URL normalization test', visibility: 'private' }, req)
    resourceIds.push(resource.id)
    expect(resource.visibility).toBe('private')
    expect(resource.ingestStatus).toBe('saved_only')
    expect(resource.sourceAccess).toBe('url_only')
    expect(resource.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await expect(payload.find({ collection: 'resources', overrideAccess: false })).rejects.toMatchObject({ status: 403 })
    await expect(payload.create({ collection: 'resources', data: { capturedAt: new Date().toISOString(), ingestStatus: 'saved_only', resourceType: 'note', sourceAccess: 'user_supplied_text', sourceId: crypto.randomUUID(), title: 'Anonymous resource', visibility: 'private' }, overrideAccess: false })).rejects.toMatchObject({ status: 403 })
  })

  it('deduplicates normalized URLs and persists explicit post/project relations', async () => {
    await expect(createResource(payload, req.user!, { resourceType: 'video', sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=duplicate', title: 'Duplicate URL', visibility: 'private' }, req)).rejects.toMatchObject({ code: 'DUPLICATE_RESOURCE', status: 409 })
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    req = await createLocalReq({ user }, payload)
    const resource = await payload.create({
      collection: 'resources',
      data: { capturedAt: new Date().toISOString(), ingestStatus: 'saved_only', notes: 'Only the personal note is stored here.', relatedPosts: [Number(postId)], relatedProjects: [Number(projectId)], resourceType: 'note', sourceAccess: 'user_supplied_text', sourceId: crypto.randomUUID(), title: 'Related resource', visibility: 'review' },
      overrideAccess: false, req,
    })
    resourceIds.push(resource.id)
    expect(resource.relatedPosts?.map((item) => typeof item === 'object' ? item.id : item)).toEqual([postId])
    expect(resource.relatedProjects?.map((item) => typeof item === 'object' ? item.id : item)).toEqual([projectId])
    const audit = await payload.find({ collection: 'audit-logs', overrideAccess: true, where: { and: [{ action: { equals: 'resource.created' } }, { resourceId: { equals: String(resource.id) } }] } })
    expect(audit.totalDocs).toBe(1)
    expect(JSON.stringify(audit.docs[0]?.metadata)).not.toContain('Only the personal note')
  })
})
