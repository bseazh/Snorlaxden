import 'dotenv/config'

import { createHash } from 'node:crypto'

import { COSPrivateStorageAdapter, SourceMaterialError } from '../modules/source-materials'

const bytes = Buffer.from('%PDF-1.7\nSnorlaxden COS private storage smoke test\n%%EOF\n')
const sha256 = createHash('sha256').update(bytes).digest('hex')
const storage = new COSPrivateStorageAdapter()
let key: string | undefined

try {
  const stored = await storage.put({
    buffer: bytes,
    extension: 'pdf',
    mimeType: 'application/pdf',
    sha256,
  })
  key = stored.key
  const downloaded = await storage.read(key)
  const downloadedChecksum = createHash('sha256').update(downloaded).digest('hex')
  if (downloadedChecksum !== sha256) throw new Error('downloaded checksum mismatch')

  await storage.delete(key)
  try {
    await storage.read(key)
    throw new Error('deleted object remained readable')
  } catch (error) {
    if (!(error instanceof SourceMaterialError) || error.code !== 'STORED_OBJECT_NOT_FOUND') throw error
  }
  key = undefined
  console.log('COS_SMOKE_OK put head get checksum delete not-found')
} finally {
  if (key) await storage.delete(key).catch(() => undefined)
}
