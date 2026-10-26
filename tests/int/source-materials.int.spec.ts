import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  COSPrivateStorageAdapter,
  type COSStorageClient,
  LocalPrivateStorageAdapter,
  privateDownloadHeaders,
  renderSourceMaterialMarkdown,
  SourceMaterialError,
  validateSourceMaterialFile,
} from '@/modules/source-materials'

const temporaryDirectories: string[] = []

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'snorlaxden-source-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe('source material file validation', () => {
  it('accepts a real PDF header and rejects a spoofed declared MIME', () => {
    const pdf = Buffer.from('%PDF-1.7\nminimal test data')
    expect(validateSourceMaterialFile(pdf, 'application/pdf')).toEqual({ extension: 'pdf', mimeType: 'application/pdf' })
    expect(() => validateSourceMaterialFile(pdf, 'image/png')).toThrowError(SourceMaterialError)
  })

  it('rejects unsupported bytes and files over 10 MB', () => {
    expect(() => validateSourceMaterialFile(Buffer.from('plain text'), 'text/plain')).toThrowError(/仅支持/)
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1)
    expect(() => validateSourceMaterialFile(oversized, 'application/pdf')).toThrowError(/10MB/)
  })
})

describe('local private storage', () => {
  it('writes files under a generated private key and reads the same bytes', async () => {
    const root = await temporaryDirectory()
    const storage = new LocalPrivateStorageAdapter(root)
    const bytes = Buffer.from('%PDF-1.7\nprivate')
    const stored = await storage.put({ buffer: bytes, extension: 'pdf', mimeType: 'application/pdf' })
    expect(stored.key).toMatch(/^private\/source-materials\/\d{4}\/\d{2}\/[0-9a-f-]+\.pdf$/)
    expect(Buffer.from(await storage.read(stored.key))).toEqual(bytes)
  })

  it('rejects path traversal and symbolic links', async () => {
    const root = await temporaryDirectory()
    const storage = new LocalPrivateStorageAdapter(root)
    await expect(storage.read('../../etc/passwd')).rejects.toThrowError(/文件标识无效/)

    const folder = path.join(root, 'private/source-materials/2026/10')
    await mkdir(folder, { recursive: true })
    const target = path.join(root, 'target.pdf')
    await writeFile(target, '%PDF-1.7')
    await symlink(target, path.join(folder, '00000000-0000-0000-0000-000000000000.pdf'))
    await expect(storage.read('private/source-materials/2026/10/00000000-0000-0000-0000-000000000000.pdf')).rejects.toThrowError(/存储对象无效/)
  })
})

const cosConfig = {
  bucket: 'digital-1486267453',
  region: 'ap-guangzhou',
  secretId: 'test-secret-id',
  secretKey: 'test-secret-key',
}

function fakeCOSClient(overrides: Partial<COSStorageClient> = {}) {
  return {
    deleteObject: vi.fn(async () => ({ statusCode: 204 })),
    getObject: vi.fn(async () => ({ Body: Buffer.from('%PDF-1.7\nfake'), ETag: 'etag', statusCode: 200 })),
    headObject: vi.fn(async () => ({
      ETag: 'etag',
      headers: { 'content-length': '14', 'x-cos-meta-sha256': 'checksum' },
      statusCode: 200,
    })),
    putObject: vi.fn(async () => ({ ETag: 'etag', Location: 'private-object', statusCode: 200 })),
    ...overrides,
  } as COSStorageClient
}

describe('COS private storage', () => {
  it('uploads private no-store objects and verifies size and SHA-256 metadata', async () => {
    const bytes = Buffer.from('%PDF-1.7\nfake')
    const client = fakeCOSClient({
      headObject: vi.fn(async () => ({
        ETag: 'etag',
        headers: { 'content-length': String(bytes.byteLength), 'x-cos-meta-sha256': 'checksum' },
        statusCode: 200,
      })),
    })
    const storage = new COSPrivateStorageAdapter(cosConfig, client)
    const stored = await storage.put({ buffer: bytes, extension: 'pdf', mimeType: 'application/pdf', sha256: 'checksum' })

    expect(stored.driver).toBe('cos')
    expect(stored.key).toMatch(/^private\/source-materials\/\d{4}\/\d{2}\/[0-9a-f-]+\.pdf$/)
    expect(client.putObject).toHaveBeenCalledWith(expect.objectContaining({
      ACL: 'private',
      Body: bytes,
      CacheControl: 'private, no-store, max-age=0',
      ContentLength: bytes.byteLength,
      ContentType: 'application/pdf',
      'x-cos-meta-sha256': 'checksum',
    }))
    expect(client.headObject).toHaveBeenCalledOnce()
  })

  it('removes an uploaded object when its integrity metadata does not match', async () => {
    const client = fakeCOSClient()
    const storage = new COSPrivateStorageAdapter(cosConfig, client)
    await expect(storage.put({
      buffer: Buffer.from('%PDF-1.7\nfake'),
      extension: 'pdf',
      mimeType: 'application/pdf',
      sha256: 'different-checksum',
    })).rejects.toMatchObject({ code: 'COS_INTEGRITY_CHECK_FAILED' })
    expect(client.deleteObject).toHaveBeenCalledOnce()
  })

  it('reads the same bytes and rejects invalid keys before calling COS', async () => {
    const bytes = Buffer.from('%PDF-1.7\nfake')
    const client = fakeCOSClient({
      getObject: vi.fn(async () => ({ Body: bytes, ETag: 'etag', statusCode: 200 })),
    })
    const storage = new COSPrivateStorageAdapter(cosConfig, client)
    const key = 'private/source-materials/2026/10/00000000-0000-0000-0000-000000000000.pdf'
    expect(Buffer.from(await storage.read(key))).toEqual(bytes)
    await expect(storage.read('../../etc/passwd')).rejects.toMatchObject({ code: 'INVALID_STORAGE_KEY' })
    expect(client.getObject).toHaveBeenCalledOnce()
  })

  it('treats a missing object as an idempotent delete', async () => {
    const client = fakeCOSClient({
      deleteObject: vi.fn(async () => { throw { code: 'NoSuchKey', statusCode: 404 } }),
    })
    const storage = new COSPrivateStorageAdapter(cosConfig, client)
    await expect(storage.delete('private/source-materials/2026/10/00000000-0000-0000-0000-000000000000.pdf')).resolves.toBeUndefined()
  })

  it('retries deletion once without exposing the raw COS error', async () => {
    const deleteObject = vi.fn()
      .mockRejectedValueOnce(new Error(`temporary ${cosConfig.secretKey}`))
      .mockResolvedValueOnce({ statusCode: 204 })
    const storage = new COSPrivateStorageAdapter(cosConfig, fakeCOSClient({ deleteObject }))
    await expect(storage.delete('private/source-materials/2026/10/00000000-0000-0000-0000-000000000000.pdf')).resolves.toBeUndefined()
    expect(deleteObject).toHaveBeenCalledTimes(2)
  })

  it('fails closed on incomplete configuration and never exposes SDK secrets', async () => {
    expect(() => new COSPrivateStorageAdapter({ ...cosConfig, secretKey: '' })).toThrowError(/配置不完整/)
    const client = fakeCOSClient({
      getObject: vi.fn(async () => {
        throw new Error(`request failed ${cosConfig.secretId} ${cosConfig.secretKey} signature-url`)
      }),
    })
    const storage = new COSPrivateStorageAdapter(cosConfig, client)
    const key = 'private/source-materials/2026/10/00000000-0000-0000-0000-000000000000.pdf'
    const error = await storage.read(key).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'COS_READ_FAILED' })
    expect(String((error as Error).message)).not.toContain(cosConfig.secretId)
    expect(String((error as Error).message)).not.toContain(cosConfig.secretKey)
    expect(String((error as Error).message)).not.toContain('signature-url')
  })
})

describe('private download and Markdown boundaries', () => {
  it('sets private no-store and anti-sniff headers', () => {
    const headers = privateDownloadHeaders('application/pdf', '研究材料.pdf')
    expect(headers['Cache-Control']).toContain('no-store')
    expect(headers['Cache-Control']).toContain('private')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Content-Disposition']).toContain('attachment')
  })

  it('keeps notes, source description, authorization, and authorized text separate', () => {
    const markdown = renderSourceMaterialMarkdown({
      authorizationBasis: 'owned', authorizationNote: '本人原创并保留权利。',
      authorizedText: '允许导出的原文。', capturedAt: '2026-10-25T00:00:00.000Z',
      personalNotes: '我的判断。', sourceDescription: '材料背景。', sourceId: 'source-test',
      sourceTitle: '原始标题', sourceUrl: 'https://example.com/source', title: '测试材料',
    })
    expect(markdown).toContain('visibility: "private"')
    expect(markdown).toContain('## 个人笔记\n\n我的判断。')
    expect(markdown).toContain('## 来源说明\n\n材料背景。')
    expect(markdown).toContain('## 授权说明\n\n本人原创并保留权利。')
    expect(markdown).toContain('## 已授权文字\n\n允许导出的原文。')
  })
})
