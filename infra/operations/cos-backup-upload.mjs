import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { cosClient, safeFailure } from './cos-client.mjs'

const [batchDirectory, batchId] = process.argv.slice(2)
if (!batchDirectory || !/^\d{8}T\d{6}Z-[0-9a-f]{7,40}$/.test(batchId || '')) throw new Error('INVALID_BACKUP_BATCH')

async function upload(client, common, localName, contentType) {
  const Body = await readFile(path.join(batchDirectory, localName))
  const sha256 = createHash('sha256').update(Body).digest('hex')
  await client.putObject({
    ...common,
    Key: `private/backups/${batchId}/${localName}`,
    ACL: 'private',
    Body,
    CacheControl: 'private, no-store, max-age=0',
    ContentLength: Body.byteLength,
    ContentType: contentType,
    'x-cos-meta-sha256': sha256,
  })
  const head = await client.headObject({ ...common, Key: `private/backups/${batchId}/${localName}` })
  if (Number(head.headers?.['content-length']) !== Body.byteLength || head.headers?.['x-cos-meta-sha256'] !== sha256) {
    throw new Error('COS_BACKUP_INTEGRITY_FAILED')
  }
}

async function run() {
  const { Bucket, Region, client } = cosClient()
  const common = { Bucket, Region }
  await upload(client, common, 'backup.tar.enc', 'application/octet-stream')
  await upload(client, common, 'manifest.json', 'application/json')
  console.log('COS_BACKUP_UPLOAD_OK files=2')
}

run().catch(() => safeFailure('COS_BACKUP_UPLOAD_FAILED'))
