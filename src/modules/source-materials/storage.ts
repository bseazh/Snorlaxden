import { createHash, randomUUID } from 'node:crypto'
import { mkdir, lstat, open, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

import COS from 'cos-nodejs-sdk-v5'

import { SourceMaterialError, type SourceMaterialMimeType } from './domain'

export type StoredPrivateObject = {
  driver: 'local' | 'cos'
  key: string
}

export interface PrivateStorageAdapter {
  readonly driver: 'local' | 'cos'
  delete(key: string): Promise<void>
  put(input: {
    buffer: Uint8Array
    extension: string
    mimeType: SourceMaterialMimeType
    sha256?: string
  }): Promise<StoredPrivateObject>
  read(key: string): Promise<Uint8Array>
}

const KEY_PATTERN = /^private\/source-materials\/\d{4}\/\d{2}\/[0-9a-f-]+\.(?:pdf|jpg|png|webp|avif)$/
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}-\d+$/
const REGION_PATTERN = /^ap-[a-z0-9-]+$/

function createObjectKey(extension: string) {
  const now = new Date()
  return `private/source-materials/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${extension}`
}

function validateObjectKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new SourceMaterialError('INVALID_STORAGE_KEY', '文件标识无效。', 400)
}

export class LocalPrivateStorageAdapter implements PrivateStorageAdapter {
  readonly driver = 'local' as const

  constructor(private readonly root = path.resolve(process.env.STORAGE_LOCAL_DIR || '.private-files')) {}

  private resolveKey(key: string) {
    validateObjectKey(key)
    const resolved = path.resolve(this.root, key)
    const relative = path.relative(this.root, resolved)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new SourceMaterialError('INVALID_STORAGE_KEY', '文件标识无效。', 400)
    }
    return resolved
  }

  async put({ buffer, extension }: { buffer: Uint8Array; extension: string; mimeType: SourceMaterialMimeType }) {
    const key = createObjectKey(extension)
    const filePath = this.resolveKey(key)
    await mkdir(path.dirname(filePath), { mode: 0o700, recursive: true })
    const handle = await open(filePath, 'wx', 0o600)
    try {
      await handle.writeFile(buffer)
    } finally {
      await handle.close()
    }
    return { driver: this.driver, key }
  }

  async read(key: string) {
    const filePath = this.resolveKey(key)
    const stat = await lstat(filePath)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new SourceMaterialError('INVALID_STORED_FILE', '存储对象无效。', 500)
    return readFile(filePath)
  }

  async delete(key: string) {
    const filePath = this.resolveKey(key)
    const stat = await lstat(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (!stat) return
    if (!stat.isFile() || stat.isSymbolicLink()) throw new SourceMaterialError('INVALID_STORED_FILE', '存储对象无效。', 500)
    await rm(filePath)
  }
}

export type COSStorageConfig = {
  bucket: string
  region: string
  secretId: string
  secretKey: string
}

export interface COSStorageClient {
  deleteObject(params: COS.DeleteObjectParams): Promise<COS.DeleteObjectResult>
  getObject(params: COS.GetObjectParams): Promise<COS.GetObjectResult>
  headObject(params: COS.HeadObjectParams): Promise<COS.HeadObjectResult>
  putObject(params: COS.PutObjectParams): Promise<COS.PutObjectResult>
}

function configurationFromEnvironment(): COSStorageConfig {
  return {
    bucket: process.env.COS_BUCKET || '',
    region: process.env.COS_REGION || '',
    secretId: process.env.COS_SECRET_ID || '',
    secretKey: process.env.COS_SECRET_KEY || '',
  }
}

function validateCOSConfiguration(config: COSStorageConfig) {
  if (
    !BUCKET_PATTERN.test(config.bucket) ||
    !REGION_PATTERN.test(config.region) ||
    !config.secretId.trim() ||
    !config.secretKey.trim()
  ) {
    throw new SourceMaterialError('COS_CONFIGURATION_MISSING', 'COS 私有存储配置不完整或格式无效。', 503)
  }
}

function isCOSNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; statusCode?: unknown }
  return candidate.statusCode === 404 || candidate.code === 'NoSuchKey' || candidate.code === 'NotFound'
}

function cosOperationError(code: string, message: string) {
  return new SourceMaterialError(code, message, 503)
}

export class COSPrivateStorageAdapter implements PrivateStorageAdapter {
  readonly driver = 'cos' as const
  private readonly client: COSStorageClient
  private readonly config: COSStorageConfig

  constructor(config = configurationFromEnvironment(), client?: COSStorageClient) {
    validateCOSConfiguration(config)
    this.config = config
    this.client = client || new COS({
      Protocol: 'https:',
      SecretId: config.secretId,
      SecretKey: config.secretKey,
      StrictSsl: true,
      Timeout: 15_000,
      UploadCheckContentMd5: true,
    })
  }

  private objectParams(key: string) {
    validateObjectKey(key)
    return { Bucket: this.config.bucket, Key: key, Region: this.config.region }
  }

  private async deleteWithRetry(key: string) {
    const params = this.objectParams(key)
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.client.deleteObject(params)
        return
      } catch (error) {
        if (isCOSNotFound(error)) return
        lastError = error
      }
    }
    throw lastError
  }

  async put({ buffer, extension, mimeType, sha256 }: {
    buffer: Uint8Array
    extension: string
    mimeType: SourceMaterialMimeType
    sha256?: string
  }): Promise<StoredPrivateObject> {
    const key = createObjectKey(extension)
    const checksum = sha256 || createHash('sha256').update(buffer).digest('hex')
    const params = this.objectParams(key)
    try {
      await this.client.putObject({
        ...params,
        ACL: 'private',
        Body: Buffer.from(buffer),
        CacheControl: 'private, no-store, max-age=0',
        ContentLength: buffer.byteLength,
        ContentType: mimeType,
        'x-cos-meta-sha256': checksum,
      })
    } catch {
      try {
        await this.deleteWithRetry(key)
      } catch {
        throw cosOperationError('COS_CLEANUP_FAILED', 'COS 上传失败，且残留对象清理失败。')
      }
      throw cosOperationError('COS_UPLOAD_FAILED', 'COS 私有对象上传失败。')
    }

    try {
      const head = await this.client.headObject(params)
      const headers = head.headers || {}
      const storedLength = Number(headers['content-length'] ?? headers['Content-Length'])
      const storedChecksum = headers['x-cos-meta-sha256'] ?? headers['X-Cos-Meta-Sha256']
      if (storedLength !== buffer.byteLength || storedChecksum !== checksum) {
        throw cosOperationError('COS_INTEGRITY_CHECK_FAILED', 'COS 私有对象完整性校验失败。')
      }
    } catch (error) {
      try {
        await this.deleteWithRetry(key)
      } catch {
        throw cosOperationError('COS_CLEANUP_FAILED', 'COS 完整性校验失败，且残留对象清理失败。')
      }
      if (error instanceof SourceMaterialError) throw error
      throw cosOperationError('COS_INTEGRITY_CHECK_FAILED', 'COS 私有对象完整性校验失败。')
    }

    return { driver: this.driver, key }
  }

  async read(key: string): Promise<Uint8Array> {
    const params = this.objectParams(key)
    try {
      const result = await this.client.getObject(params)
      return new Uint8Array(result.Body)
    } catch (error) {
      if (isCOSNotFound(error)) throw new SourceMaterialError('STORED_OBJECT_NOT_FOUND', '存储对象不存在。', 404)
      throw cosOperationError('COS_READ_FAILED', 'COS 私有对象读取失败。')
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.deleteWithRetry(key)
    } catch {
      throw cosOperationError('COS_DELETE_FAILED', 'COS 私有对象删除失败。')
    }
  }
}

export function getPrivateStorage(recordedDriver?: string | null): PrivateStorageAdapter {
  const driver = recordedDriver || process.env.STORAGE_DRIVER || 'local'
  if (driver === 'local') return new LocalPrivateStorageAdapter()
  if (driver === 'cos') return new COSPrivateStorageAdapter()
  throw new SourceMaterialError('INVALID_STORAGE_DRIVER', 'STORAGE_DRIVER 只能是 local 或 cos。', 500)
}
