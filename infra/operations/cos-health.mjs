import { createHash, randomUUID } from 'node:crypto'

import { cosClient, safeFailure } from './cos-client.mjs'

async function run() {
  const { Bucket, Region, client } = cosClient()
  const now = new Date()
  const Key = `private/source-materials/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.pdf`
  const Body = Buffer.from('%PDF-1.7\nCOS health probe\n%%EOF\n')
  const sha256 = createHash('sha256').update(Body).digest('hex')
  const common = { Bucket, Region, Key }
  try {
    await client.putObject({
      ...common,
      ACL: 'private',
      Body,
      CacheControl: 'private, no-store, max-age=0',
      ContentLength: Body.byteLength,
      ContentType: 'application/pdf',
      'x-cos-meta-sha256': sha256,
    })
    const head = await client.headObject(common)
    if (Number(head.headers?.['content-length']) !== Body.byteLength || head.headers?.['x-cos-meta-sha256'] !== sha256) {
      throw new Error('COS_HEALTH_INTEGRITY_FAILED')
    }
    console.log('COS_HEALTH_OK')
  } finally {
    await client.deleteObject(common).catch(() => undefined)
  }
}

run().catch(() => safeFailure('COS_HEALTH_FAILED'))
