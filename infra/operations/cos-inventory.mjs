import { writeFile } from 'node:fs/promises'

import { cosClient, safeFailure } from './cos-client.mjs'

const output = process.argv[2]
if (!output) throw new Error('OUTPUT_PATH_REQUIRED')

async function run() {
  const { Bucket, Region, client } = cosClient()
  const objects = []
  let Marker
  do {
    const page = await client.getBucket({ Bucket, Region, Prefix: 'private/source-materials/', Marker, MaxKeys: 1000 })
    for (const object of page.Contents || []) {
      const head = await client.headObject({ Bucket, Region, Key: object.Key })
      objects.push({
        etag: object.ETag || null,
        key: object.Key,
        lastModified: object.LastModified || null,
        sha256: head.headers?.['x-cos-meta-sha256'] || null,
        size: Number(object.Size || head.headers?.['content-length'] || 0),
      })
    }
    Marker = page.IsTruncated === 'true' ? page.NextMarker : undefined
  } while (Marker)
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), objects }, null, 2)}\n`, { mode: 0o600 })
  console.log(`COS_INVENTORY_OK objects=${objects.length}`)
}

run().catch(() => safeFailure('COS_INVENTORY_FAILED'))
