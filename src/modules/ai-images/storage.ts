import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

import COS from 'cos-nodejs-sdk-v5'

import { AIImageError, type ImageCandidate } from './domain'

const KEY_PATTERN = /^private\/ai-image-candidates\/\d{4}\/\d{2}\/\d+\/[0-9a-f-]+\.(?:jpg|png|webp)$/

function validateKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new AIImageError('INVALID_IMAGE_STORAGE_KEY', '候选图存储标识无效。')
}

function objectKey(generationId: number | string, extension: string) {
  const now = new Date()
  return `private/ai-image-candidates/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${generationId}/${randomUUID()}.${extension}`
}

export interface ImageCandidateStorage {
  readonly driver: 'local' | 'cos'
  delete(key: string): Promise<void>
  put(input: { bytes: Uint8Array; generationId: number | string; mimeType: ImageCandidate['mimeType']; sha256: string }): Promise<string>
  read(key: string): Promise<Uint8Array>
}

export class LocalImageCandidateStorage implements ImageCandidateStorage {
  readonly driver = 'local' as const
  constructor(private readonly root = path.resolve(process.env.STORAGE_LOCAL_DIR || '.private-files')) {}
  private resolve(key: string) {
    validateKey(key)
    const resolved = path.resolve(this.root, key)
    const relative = path.relative(this.root, resolved)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new AIImageError('INVALID_IMAGE_STORAGE_KEY', '候选图存储标识无效。')
    return resolved
  }
  async put(input: { bytes: Uint8Array; generationId: number | string; mimeType: ImageCandidate['mimeType']; sha256: string }) {
    const extension = input.mimeType === 'image/jpeg' ? 'jpg' : input.mimeType.split('/')[1]
    const key = objectKey(input.generationId, extension)
    const filePath = this.resolve(key)
    await mkdir(path.dirname(filePath), { mode: 0o700, recursive: true })
    const handle = await open(filePath, 'wx', 0o600)
    try { await handle.writeFile(input.bytes) } finally { await handle.close() }
    return key
  }
  async read(key: string) {
    const filePath = this.resolve(key)
    const stat = await lstat(filePath)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new AIImageError('IMAGE_NOT_FOUND', '候选图不存在。', 404)
    return new Uint8Array(await readFile(filePath))
  }
  async delete(key: string) {
    const filePath = this.resolve(key)
    const stat = await lstat(filePath).catch((error: NodeJS.ErrnoException) => error.code === 'ENOENT' ? null : Promise.reject(error))
    if (!stat) return
    if (!stat.isFile() || stat.isSymbolicLink()) throw new AIImageError('INVALID_IMAGE_STORAGE_KEY', '候选图存储对象无效。')
    await rm(filePath)
  }
}

export class COSImageCandidateStorage implements ImageCandidateStorage {
  readonly driver = 'cos' as const
  private readonly bucket = process.env.COS_BUCKET || ''
  private readonly region = process.env.COS_REGION || ''
  private readonly client: COS
  constructor() {
    const secretId = process.env.COS_SECRET_ID || ''
    const secretKey = process.env.COS_SECRET_KEY || ''
    if (!this.bucket || !this.region || !secretId || !secretKey) throw new AIImageError('COS_CONFIGURATION_MISSING', 'COS 私有存储配置不完整。', 503)
    this.client = new COS({ Protocol: 'https:', SecretId: secretId, SecretKey: secretKey, StrictSsl: true, Timeout: 15_000, UploadCheckContentMd5: true })
  }
  private params(key: string) { validateKey(key); return { Bucket: this.bucket, Key: key, Region: this.region } }
  async put(input: { bytes: Uint8Array; generationId: number | string; mimeType: ImageCandidate['mimeType']; sha256: string }) {
    const extension = input.mimeType === 'image/jpeg' ? 'jpg' : input.mimeType.split('/')[1]
    const key = objectKey(input.generationId, extension)
    const params = this.params(key)
    try {
      await this.client.putObject({ ...params, ACL: 'private', Body: Buffer.from(input.bytes), CacheControl: 'private, no-store, max-age=0', ContentLength: input.bytes.byteLength, ContentType: input.mimeType, 'x-cos-meta-sha256': input.sha256 })
      const head = await this.client.headObject(params)
      const length = Number(head.headers?.['content-length'] ?? head.headers?.['Content-Length'])
      const checksum = head.headers?.['x-cos-meta-sha256'] ?? head.headers?.['X-Cos-Meta-Sha256']
      if (length !== input.bytes.byteLength || checksum !== input.sha256) throw new Error('integrity')
      return key
    } catch {
      await this.client.deleteObject(params).catch(() => undefined)
      throw new AIImageError('COS_IMAGE_UPLOAD_FAILED', '候选图保存到 COS 失败。', 503)
    }
  }
  async read(key: string) {
    try { const result = await this.client.getObject(this.params(key)); return new Uint8Array(result.Body) }
    catch { throw new AIImageError('IMAGE_READ_FAILED', '候选图读取失败。', 503) }
  }
  async delete(key: string) {
    try { await this.client.deleteObject(this.params(key)) }
    catch { throw new AIImageError('IMAGE_DELETE_FAILED', '候选图删除失败。', 503) }
  }
}

export function getImageCandidateStorage(recordedDriver?: string | null): ImageCandidateStorage {
  const driver = recordedDriver || process.env.STORAGE_DRIVER || 'local'
  if (driver === 'local') return new LocalImageCandidateStorage()
  if (driver === 'cos') return new COSImageCandidateStorage()
  throw new AIImageError('INVALID_STORAGE_DRIVER', '图片存储驱动无效。', 500)
}

export function checksum(bytes: Uint8Array) { return createHash('sha256').update(bytes).digest('hex') }

