import config from '@/payload.config'
import { writeAuditLog } from '@/modules/audit'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let userId: number
let postId: number | string
let req: PayloadRequest
const createdAuditIds: Array<number | string> = []

describe('audit logs', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const user = await payload.create({
      collection: 'users',
      context: { skipAudit: true },
      data: { email: `audit-${Date.now()}@example.com`, name: 'Audit Test Admin', password: 'test-password', role: 'admin' },
      overrideAccess: true,
    })
    userId = user.id
    req = await createLocalReq({ user }, payload)
    const post = await payload.create({
      collection: 'posts',
      context: { skipAudit: true },
      data: {
        content: { root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 } },
        contentType: 'essay',
        reviewState: 'editing',
        slug: `audit-post-${Date.now()}`,
        summary: '用于验证内容修改能够生成审计日志。',
        title: '审计日志测试文章',
      },
      draft: true,
      overrideAccess: true,
    })
    postId = post.id
  })

  afterAll(async () => {
    if (postId) await payload.delete({ collection: 'posts', context: { skipAudit: true }, id: postId, overrideAccess: true })
    for (const id of createdAuditIds) await payload.delete({ collection: 'audit-logs', context: { skipAudit: true }, id, overrideAccess: true })
    if (userId) await payload.delete({ collection: 'users', context: { skipAudit: true }, id: userId, overrideAccess: true })
  })

  it('persists a redacted audit event with a hashed IP', async () => {
    await writeAuditLog(payload, {
      action: 'test.audit.created',
      actorId: userId,
      metadata: { apiKey: 'must-not-be-saved', safeField: 'safe-value' },
      request: { headers: new Headers({ 'x-forwarded-for': '192.0.2.20', 'x-request-id': 'audit-test-request' }) },
      resourceId: postId,
      resourceType: 'post',
    })
    const result = await payload.find({ collection: 'audit-logs', overrideAccess: true, where: { requestId: { equals: 'audit-test-request' } } })
    expect(result.totalDocs).toBe(1)
    expect(result.docs[0]?.ipHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.docs[0]?.metadata).toEqual({ safeField: 'safe-value' })
    createdAuditIds.push(result.docs[0]!.id)
  })

  it('automatically records an administrator content update', async () => {
    await payload.update({ collection: 'posts', data: { title: '审计日志测试文章（已修改）' }, draft: true, id: postId, overrideAccess: true, req })
    const result = await payload.find({ collection: 'audit-logs', overrideAccess: true, where: { and: [{ action: { equals: 'post.updated' } }, { resourceId: { equals: String(postId) } }] } })
    expect(result.totalDocs).toBeGreaterThanOrEqual(1)
    expect((result.docs[0]?.metadata as Record<string, unknown>)?.changedFields).toContain('title')
    result.docs.forEach((doc) => createdAuditIds.push(doc.id))
  })

  it('blocks anonymous reads and all access-controlled mutations', async () => {
    await expect(payload.find({ collection: 'audit-logs', overrideAccess: false })).rejects.toMatchObject({ status: 403 })
    await expect(payload.create({ collection: 'audit-logs', data: { action: 'forbidden', outcome: 'success', requestId: 'forbidden', resourceType: 'test' }, overrideAccess: false })).rejects.toMatchObject({ status: 403 })
    await expect(payload.delete({ collection: 'audit-logs', id: createdAuditIds[0]!, overrideAccess: false, req })).rejects.toMatchObject({ status: 403 })
  })
})
