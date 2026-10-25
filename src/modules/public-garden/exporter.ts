import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import matter from 'gray-matter'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { detectSourceMaterialMime } from '../source-materials'
import {
  PublicGardenError,
  type PublicGardenAttachmentRule,
  type PublicGardenAuditEvent,
  type PublicGardenExportConfig,
  type PublicGardenManifest,
  type PublicGardenNoteRule,
} from './domain'

type AuditSink = (event: PublicGardenAuditEvent) => Promise<void> | void
type Replacement = { end: number; start: number; value: string }

const OUTPUT_MARKER = '.snorlaxden-public-garden'
const ALLOWED_AUTHORIZATION = new Set(['open_license', 'owned', 'permission', 'public_domain'])
const SENSITIVE_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[a-zA-Z0-9_-]{20,}\b/,
  /\b(?:api[_-]?key|secret[_-]?key|password)\s*[:=]\s*\S+/i,
  /SNORLAXDEN_PRIVATE_TEST_MARKER/,
]

function sha256(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex')
}

function fingerprint(value: Uint8Array | string) {
  return sha256(value).slice(0, 16)
}

function validateRelativePath(value: string, label: string) {
  if (!value || value.includes('\\') || path.posix.isAbsolute(value)) {
    throw new PublicGardenError('INVALID_PATH', `${label} 必须是 POSIX 相对路径。`)
  }
  const normalized = path.posix.normalize(value)
  const parts = normalized.split('/')
  if (normalized !== value || parts.some((part) => !part || part === '..' || part.startsWith('.'))) {
    throw new PublicGardenError('INVALID_PATH', `${label} 包含越界、隐藏或无效路径。`)
  }
  return normalized
}

function parseConfig(input: unknown): PublicGardenExportConfig {
  if (!input || typeof input !== 'object') throw new PublicGardenError('INVALID_MANIFEST', '白名单 manifest 必须是对象。')
  const value = input as Partial<PublicGardenExportConfig>
  if (value.version !== 1 || !Array.isArray(value.notes) || !Array.isArray(value.attachments)) {
    throw new PublicGardenError('INVALID_MANIFEST', '白名单 manifest 版本或结构无效。')
  }
  const notes = value.notes.map((entry, index): PublicGardenNoteRule => {
    if (!entry || typeof entry.source !== 'string' || typeof entry.output !== 'string') {
      throw new PublicGardenError('INVALID_MANIFEST', `notes[${index}] 无效。`)
    }
    const source = validateRelativePath(entry.source, `notes[${index}].source`)
    const output = validateRelativePath(entry.output, `notes[${index}].output`)
    if (!source.endsWith('.md') || !output.endsWith('.md')) throw new PublicGardenError('INVALID_MANIFEST', '笔记路径必须以 .md 结尾。')
    return { output, source }
  })
  const attachments = value.attachments.map((entry, index): PublicGardenAttachmentRule => {
    if (!entry || typeof entry.source !== 'string' || typeof entry.output !== 'string' || typeof entry.sha256 !== 'string' || !ALLOWED_AUTHORIZATION.has(entry.authorization)) {
      throw new PublicGardenError('INVALID_MANIFEST', `attachments[${index}] 无效。`)
    }
    if (!/^[a-f0-9]{64}$/i.test(entry.sha256)) throw new PublicGardenError('INVALID_MANIFEST', `attachments[${index}].sha256 无效。`)
    return {
      authorization: entry.authorization,
      output: validateRelativePath(entry.output, `attachments[${index}].output`),
      sha256: entry.sha256.toLowerCase(),
      source: validateRelativePath(entry.source, `attachments[${index}].source`),
    }
  })
  for (const entries of [notes, attachments]) {
    const sources = new Set<string>()
    const outputs = new Set<string>()
    for (const entry of entries) {
      if (sources.has(entry.source) || outputs.has(entry.output)) throw new PublicGardenError('DUPLICATE_MANIFEST_ENTRY', '白名单包含重复来源或输出路径。')
      sources.add(entry.source)
      outputs.add(entry.output)
    }
  }
  const everyOutput = [...notes, ...attachments].map((entry) => entry.output)
  if (new Set(everyOutput).size !== everyOutput.length || everyOutput.includes('manifest.json') || everyOutput.includes(OUTPUT_MARKER)) {
    throw new PublicGardenError('DUPLICATE_MANIFEST_ENTRY', '笔记与附件输出路径冲突。')
  }
  return { attachments, notes, version: 1 }
}

async function validateRoot(root: string) {
  const absolute = path.resolve(root)
  const stat = await lstat(absolute).catch(() => null)
  if (!stat?.isDirectory() || stat.isSymbolicLink()) throw new PublicGardenError('INVALID_SOURCE_ROOT', '来源根目录不存在、不是目录或是符号链接。')
  return realpath(absolute)
}

async function readSecureFile(root: string, relativePath: string) {
  const parts = relativePath.split('/')
  let current = root
  for (const part of parts) {
    current = path.join(current, part)
    const stat = await lstat(current).catch(() => null)
    if (!stat) throw new PublicGardenError('SOURCE_NOT_FOUND', '白名单来源文件不存在。')
    if (stat.isSymbolicLink()) throw new PublicGardenError('SYMLINK_REJECTED', '来源路径包含符号链接。')
  }
  const stat = await lstat(current)
  if (!stat.isFile()) throw new PublicGardenError('INVALID_SOURCE_FILE', '白名单来源不是普通文件。')
  const resolved = await realpath(current)
  if (path.relative(root, resolved).startsWith('..')) throw new PublicGardenError('PATH_TRAVERSAL', '来源文件越过允许目录。')
  return readFile(resolved)
}

function normalizeReference(noteSource: string, reference: string) {
  let decoded: string
  try { decoded = decodeURIComponent(reference.split(/[?#]/, 1)[0] || '') } catch { throw new PublicGardenError('INVALID_REFERENCE', 'Markdown 引用编码无效。') }
  if (!decoded || decoded.startsWith('#')) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded) || decoded.startsWith('//')) {
    if (/^(?:https?:|mailto:)/i.test(decoded)) return null
    throw new PublicGardenError('UNSAFE_REFERENCE', 'Markdown 包含不安全协议。')
  }
  if (decoded.includes('\\') || path.posix.isAbsolute(decoded)) throw new PublicGardenError('PATH_TRAVERSAL', 'Markdown 包含绝对或非 POSIX 路径。')
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(noteSource), decoded))
  if (joined === '..' || joined.startsWith('../') || joined.split('/').some((part) => part.startsWith('.'))) {
    throw new PublicGardenError('PATH_TRAVERSAL', 'Markdown 引用越过允许目录或进入隐藏目录。')
  }
  return joined
}

function relativeOutput(from: string, to: string) {
  const relative = path.posix.relative(path.posix.dirname(from), to)
  return relative.startsWith('.') ? relative : `./${relative}`
}

function nodeText(node: { children?: Array<{ type?: string; value?: string; children?: unknown[] }> }): string {
  return (node.children || []).map((child) => child.type === 'text' || child.type === 'inlineCode' ? child.value || '' : nodeText(child as typeof node)).join('')
}

function applyReplacements(markdown: string, replacements: Replacement[]) {
  const sorted = replacements.sort((a, b) => b.start - a.start)
  let result = markdown
  let previousStart = markdown.length + 1
  for (const replacement of sorted) {
    if (replacement.end > previousStart) continue
    result = `${result.slice(0, replacement.start)}${replacement.value}${result.slice(replacement.end)}`
    previousStart = replacement.start
  }
  return result
}

function publicFrontmatter(data: Record<string, unknown>) {
  const result: Record<string, unknown> = {
    publish: true,
    title: String(data.title).trim(),
    visibility: 'public',
  }
  if (typeof data.description === 'string' && data.description.trim()) result.description = data.description.trim()
  if (typeof data.date === 'string' || data.date instanceof Date) result.date = data.date
  if (Array.isArray(data.tags) && data.tags.every((tag) => typeof tag === 'string')) result.tags = data.tags
  return result
}

function transformMarkdown(
  markdown: string,
  note: PublicGardenNoteRule,
  noteBySource: Map<string, PublicGardenNoteRule>,
  attachmentBySource: Map<string, PublicGardenAttachmentRule>,
  references: Map<string, Set<string>>,
) {
  const replacements: Replacement[] = []
  const handleReference = (reference: string, label: string, embedded: boolean, start: number, end: number) => {
    const target = normalizeReference(note.source, reference)
    if (!target) return
    const noteTarget = noteBySource.get(target) || (!path.posix.extname(target) ? noteBySource.get(`${target}.md`) : undefined)
    if (noteTarget) {
      replacements.push({ end, start, value: `[${label || '公开笔记'}](${relativeOutput(note.output, noteTarget.output)})` })
      return
    }
    const attachment = attachmentBySource.get(target)
    if (attachment) {
      references.get(attachment.source)?.add(note.output)
      replacements.push({ end, start, value: `${embedded ? '!' : ''}[${label || path.posix.basename(target)}](${relativeOutput(note.output, attachment.output)})` })
      return
    }
    if (target.endsWith('.md') || !path.posix.extname(target)) {
      replacements.push({ end, start, value: '[非公开笔记]' })
      return
    }
    throw new PublicGardenError('UNAUTHORIZED_ATTACHMENT', '笔记引用了未在白名单授权的本地附件。')
  }

  const tree = unified().use(remarkParse).parse(markdown) as { type: string }
  visit(tree, (node: { position?: { end?: { offset?: number }; start?: { offset?: number } }; type?: string; url?: string; children?: unknown[] }) => {
    if (node.type === 'html' && node.position?.start?.offset != null && node.position.end?.offset != null) {
      const raw = markdown.slice(node.position.start.offset, node.position.end.offset)
      if (/\b(?:href|src)\s*=/i.test(raw)) throw new PublicGardenError('RAW_HTML_REFERENCE', '公开笔记不允许在原始 HTML 中引用文件。')
    }
    if (node.type === 'definition' && node.url && normalizeReference(note.source, node.url)) {
      throw new PublicGardenError('REFERENCE_LINK_REJECTED', '公开笔记的本地引用必须使用行内链接或 wikilink。')
    }
    if ((node.type !== 'link' && node.type !== 'image') || !node.url || node.position?.start?.offset == null || node.position.end?.offset == null) return
    handleReference(node.url, node.type === 'image' ? '' : nodeText(node as never), node.type === 'image', node.position.start.offset, node.position.end.offset)
  })

  const wikiPattern = /(!?)\[\[([^\]\n]+)\]\]/g
  for (const match of markdown.matchAll(wikiPattern)) {
    const start = match.index
    const end = start + match[0].length
    const [target, alias = ''] = match[2].split('|', 2).map((part) => part.trim())
    handleReference(target, alias, match[1] === '!', start, end)
  }
  return applyReplacements(markdown, replacements)
}

async function countManagedEntries(outputDirectory: string) {
  const entries = await readdir(outputDirectory, { recursive: true }).catch(() => [])
  return entries.filter((entry) => entry !== '.gitignore' && entry !== OUTPUT_MARKER && entry !== 'manifest.json').length
}

async function assertReplaceableOutput(outputDirectory: string) {
  const stat = await lstat(outputDirectory).catch(() => null)
  if (!stat) return
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new PublicGardenError('UNSAFE_OUTPUT', '输出目标不是安全目录。')
  const entries = await readdir(outputDirectory)
  if (!entries.includes(OUTPUT_MARKER) && entries.some((entry) => entry !== '.gitignore')) {
    throw new PublicGardenError('UNSAFE_OUTPUT', '拒绝替换不属于公开花园导出器的目录。')
  }
}

export async function exportPublicGarden(input: {
  audit?: AuditSink
  config: PublicGardenExportConfig | unknown
  now?: Date
  outputDirectory: string
  sourceRoot: string
}) {
  const audit = input.audit || (() => undefined)
  let noteCount = 0
  let attachmentCount = 0
  try {
    const config = parseConfig(input.config)
    const sourceRoot = await validateRoot(input.sourceRoot)
    const outputDirectory = path.resolve(input.outputDirectory)
    if (outputDirectory === sourceRoot || !path.relative(sourceRoot, outputDirectory).startsWith('..')) {
      throw new PublicGardenError('UNSAFE_OUTPUT', '输出目录不能位于来源根目录内。')
    }
    await assertReplaceableOutput(outputDirectory)
    const removedEntries = await countManagedEntries(outputDirectory)
    const parent = path.dirname(outputDirectory)
    await mkdir(parent, { recursive: true })
    const temporary = await mkdtemp(path.join(parent, '.public-garden-tmp-'))
    const backup = path.join(parent, `.public-garden-backup-${randomUUID()}`)
    let movedExisting = false
    try {
      const noteBySource = new Map(config.notes.map((entry) => [entry.source, entry]))
      const attachmentBySource = new Map(config.attachments.map((entry) => [entry.source, entry]))
      const references = new Map(config.attachments.map((entry) => [entry.source, new Set<string>()]))
      const manifestNotes: PublicGardenManifest['notes'] = []
      const manifestAttachments: PublicGardenManifest['attachments'] = []

      for (const note of config.notes) {
        const source = (await readSecureFile(sourceRoot, note.source)).toString('utf8')
        if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(source))) throw new PublicGardenError('SENSITIVE_CONTENT', '公开笔记触发敏感内容规则。')
        const parsed = matter(source)
        if (parsed.data.publish !== true || parsed.data.visibility !== 'public' || typeof parsed.data.title !== 'string' || !parsed.data.title.trim()) {
          throw new PublicGardenError('NOTE_NOT_PUBLIC', '白名单笔记缺少 publish: true、visibility: public 或标题。')
        }
        const transformedBody = transformMarkdown(parsed.content, note, noteBySource, attachmentBySource, references)
        const transformed = matter.stringify(transformedBody, publicFrontmatter(parsed.data))
        const destination = path.join(temporary, note.output)
        await mkdir(path.dirname(destination), { recursive: true })
        await writeFile(destination, transformed, { encoding: 'utf8', flag: 'wx', mode: 0o644 })
        manifestNotes.push({ output: note.output, sha256: sha256(transformed), sourceFingerprint: fingerprint(source), title: parsed.data.title.trim() })
      }

      for (const attachment of config.attachments) {
        const bytes = await readSecureFile(sourceRoot, attachment.source)
        const actualSha256 = sha256(bytes)
        if (actualSha256 !== attachment.sha256) throw new PublicGardenError('ATTACHMENT_CHECKSUM_MISMATCH', '附件校验和与白名单不一致。')
        if (!detectSourceMaterialMime(bytes)) throw new PublicGardenError('UNSUPPORTED_ATTACHMENT', '公开附件必须是受支持的 PDF 或图片。')
        const destination = path.join(temporary, attachment.output)
        await mkdir(path.dirname(destination), { recursive: true })
        await writeFile(destination, bytes, { flag: 'wx', mode: 0o644 })
        manifestAttachments.push({
          authorization: attachment.authorization,
          byteSize: bytes.byteLength,
          output: attachment.output,
          referencedBy: [...(references.get(attachment.source) || [])].sort(),
          sha256: actualSha256,
          sourceFingerprint: fingerprint(bytes),
        })
      }

      const manifest: PublicGardenManifest = {
        attachments: manifestAttachments.sort((a, b) => a.output.localeCompare(b.output)),
        generatedAt: (input.now || new Date()).toISOString(),
        notes: manifestNotes.sort((a, b) => a.output.localeCompare(b.output)),
        removedEntries,
        version: 1,
      }
      await writeFile(path.join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o644 })
      await writeFile(path.join(temporary, OUTPUT_MARKER), 'managed by Snorlaxden public garden exporter\n', { encoding: 'utf8', flag: 'wx', mode: 0o644 })
      await writeFile(path.join(temporary, '.gitignore'), '*\n!.gitignore\n', { encoding: 'utf8', flag: 'wx', mode: 0o644 })

      const outputExists = await lstat(outputDirectory).then(() => true).catch(() => false)
      if (outputExists) { await rename(outputDirectory, backup); movedExisting = true }
      try { await rename(temporary, outputDirectory) } catch (error) {
        if (movedExisting) await rename(backup, outputDirectory)
        throw error
      }
      noteCount = manifest.notes.length
      attachmentCount = manifest.attachments.length
      try {
        await audit({ action: 'public-garden.exported', metadata: { attachmentCount, noteCount, removedEntries }, outcome: 'success' })
      } catch (error) {
        await rm(outputDirectory, { force: true, recursive: true })
        if (movedExisting) await rename(backup, outputDirectory)
        throw error
      }
      if (movedExisting) await rm(backup, { force: true, recursive: true })
      return manifest
    } catch (error) {
      await rm(temporary, { force: true, recursive: true })
      throw error
    }
  } catch (error) {
    const rejection = error instanceof PublicGardenError
    await audit({
      action: rejection ? 'public-garden.export_rejected' : 'public-garden.export_failed',
      metadata: { attachmentCount, errorCode: rejection ? error.code : 'EXPORT_FAILED', noteCount },
      outcome: 'failure',
    })
    throw error
  }
}

export async function loadPublicGardenConfig(filePath: string) {
  return parseConfig(JSON.parse(await readFile(path.resolve(filePath), 'utf8')))
}
