export const SOURCE_MATERIAL_MAX_BYTES = 10 * 1024 * 1024

export const SOURCE_MATERIAL_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const

export type SourceMaterialMimeType = (typeof SOURCE_MATERIAL_MIME_TYPES)[number]

export class SourceMaterialError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

const MIME_EXTENSIONS: Record<SourceMaterialMimeType, string> = {
  'application/pdf': 'pdf',
  'image/avif': 'avif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function detectSourceMaterialMime(buffer: Uint8Array): SourceMaterialMimeType | null {
  if (buffer.length >= 5 && Buffer.from(buffer.subarray(0, 5)).toString('ascii') === '%PDF-') return 'application/pdf'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && Buffer.from(buffer.subarray(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.length >= 12 && Buffer.from(buffer.subarray(0, 4)).toString('ascii') === 'RIFF' && Buffer.from(buffer.subarray(8, 12)).toString('ascii') === 'WEBP') return 'image/webp'
  if (buffer.length >= 12 && Buffer.from(buffer.subarray(4, 8)).toString('ascii') === 'ftyp' && Buffer.from(buffer.subarray(8, 12)).toString('ascii').startsWith('avi')) return 'image/avif'
  return null
}

export function validateSourceMaterialFile(buffer: Uint8Array, declaredMime?: string) {
  if (buffer.length === 0) throw new SourceMaterialError('EMPTY_FILE', '不能上传空文件。', 400)
  if (buffer.length > SOURCE_MATERIAL_MAX_BYTES) throw new SourceMaterialError('FILE_TOO_LARGE', '文件不能超过 10MB。', 413)
  const detectedMime = detectSourceMaterialMime(buffer)
  if (!detectedMime) throw new SourceMaterialError('UNSUPPORTED_FILE', '仅支持 PDF、JPEG、PNG、WebP 和 AVIF。', 415)
  if (declaredMime && declaredMime !== 'application/octet-stream' && declaredMime !== detectedMime) {
    throw new SourceMaterialError('MIME_MISMATCH', '文件内容与声明的 MIME 类型不一致。', 415)
  }
  return { extension: MIME_EXTENSIONS[detectedMime], mimeType: detectedMime }
}

export function parseRelationshipIds(value: FormDataEntryValue | null) {
  if (!value || typeof value !== 'string') return []
  const entries = value.split(',').map((item) => item.trim()).filter(Boolean)
  if (entries.some((item) => !/^\d+$/.test(item))) throw new SourceMaterialError('INVALID_RELATION', '关联 ID 格式不正确。', 400)
  return [...new Set(entries.map(Number))]
}
