import { randomUUID } from 'node:crypto'
import { mkdir, lstat, open, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

import { SourceMaterialError, type SourceMaterialMimeType } from './domain'

export type StoredPrivateObject = {
  driver: 'local' | 'cos'
  key: string
}

export interface PrivateStorageAdapter {
  readonly driver: 'local' | 'cos'
  delete(key: string): Promise<void>
  put(input: { buffer: Uint8Array; extension: string; mimeType: SourceMaterialMimeType }): Promise<StoredPrivateObject>
  read(key: string): Promise<Uint8Array>
}

const KEY_PATTERN = /^private\/source-materials\/\d{4}\/\d{2}\/[0-9a-f-]+\.(?:pdf|jpg|png|webp|avif)$/

export class LocalPrivateStorageAdapter implements PrivateStorageAdapter {
  readonly driver = 'local' as const

  constructor(private readonly root = path.resolve(process.env.STORAGE_LOCAL_DIR || '.private-files')) {}

  private resolveKey(key: string) {
    if (!KEY_PATTERN.test(key)) throw new SourceMaterialError('INVALID_STORAGE_KEY', '文件标识无效。', 400)
    const resolved = path.resolve(this.root, key)
    const relative = path.relative(this.root, resolved)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new SourceMaterialError('INVALID_STORAGE_KEY', '文件标识无效。', 400)
    }
    return resolved
  }

  async put({ buffer, extension }: { buffer: Uint8Array; extension: string; mimeType: SourceMaterialMimeType }) {
    const now = new Date()
    const key = `private/source-materials/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${extension}`
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

export class COSPrivateStorageAdapter implements PrivateStorageAdapter {
  readonly driver = 'cos' as const

  private unavailable(): never {
    throw new SourceMaterialError(
      'COS_ADAPTER_NOT_CONFIGURED',
      'COS Adapter 尚未启用；请先配置 Region、SecretId、SecretKey 并安装官方 SDK。',
      503,
    )
  }

  async put(): Promise<StoredPrivateObject> { return this.unavailable() }
  async read(): Promise<Uint8Array> { return this.unavailable() }
  async delete(): Promise<void> { return this.unavailable() }
}

export function getPrivateStorage(recordedDriver?: string | null): PrivateStorageAdapter {
  const driver = recordedDriver || process.env.STORAGE_DRIVER || 'local'
  if (driver === 'local') return new LocalPrivateStorageAdapter()
  if (driver === 'cos') return new COSPrivateStorageAdapter()
  throw new SourceMaterialError('INVALID_STORAGE_DRIVER', 'STORAGE_DRIVER 只能是 local 或 cos。', 500)
}
