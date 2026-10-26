import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import config from '@payload-config'
import { getPayload } from 'payload'

import { getPrivateStorage, validateSourceMaterialFile } from '@/modules/source-materials'

const filePath = process.argv[2]
if (!filePath) throw new Error('Usage: pnpm character-reference:import -- /absolute/path/to/reference.png')

const payload = await getPayload({ config })
const users = await payload.find({ collection: 'users', limit: 1, overrideAccess: true, sort: 'createdAt', where: { role: { equals: 'admin' } } })
const user = users.docs[0]
if (!user) throw new Error('No administrator exists.')

const bytes = new Uint8Array(await readFile(path.resolve(filePath)))
const { extension, mimeType } = validateSourceMaterialFile(bytes, undefined)
if (!mimeType.startsWith('image/')) throw new Error('Character reference must be an image.')
const sha256 = createHash('sha256').update(bytes).digest('hex')
const existing = await payload.find({ collection: 'source-materials', limit: 1, overrideAccess: true, where: { sha256: { equals: sha256 } } })
if (existing.totalDocs) {
  console.log(JSON.stringify({ created: false, id: existing.docs[0].id, storageDriver: existing.docs[0].storageDriver }))
  process.exit(0)
}

const storage = getPrivateStorage()
const stored = await storage.put({ buffer: bytes, extension, mimeType, sha256 })
try {
  const material = await payload.create({
    collection: 'source-materials', overrideAccess: true,
    data: {
      author: user.id,
      authorizationBasis: 'owned',
      authorizationNote: '站长提供并确认拥有使用权的固定人物插画参考资产；仅用于私有 AI 图片工作台的人物身份与画风锚定。',
      byteSize: bytes.byteLength,
      capturedAt: new Date().toISOString(),
      materialType: 'owned_image',
      mimeType,
      originalFileName: path.basename(filePath).slice(0, 240),
      privacy: 'private',
      sha256,
      sourceDescription: '固定人物参考资产。禁止复制原图文字、Logo、拼贴布局、吉祥物或额外人物。',
      sourceId: `source-${randomUUID()}`,
      storageDriver: stored.driver,
      storageKey: stored.key,
      title: '数字花园固定人物参考图',
    },
  })
  console.log(JSON.stringify({ created: true, id: material.id, storageDriver: stored.driver }))
} catch (error) {
  await storage.delete(stored.key).catch(() => undefined)
  throw error
}

