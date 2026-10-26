import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

import matter from 'gray-matter'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import type { PublicGardenManifest } from './domain'

export type GardenHeading = { depth: number; id: string; title: string }

export type GardenNote = {
  backlinks: Array<{ title: string; url: string }>
  body: string
  date?: string
  description?: string
  headings: GardenHeading[]
  output: string
  sha256: string
  tags: string[]
  title: string
  updatedAt: string
  url: string
}

export type GardenIndex = {
  generatedAt?: string
  manifest: PublicGardenManifest | null
  notes: GardenNote[]
  tags: Array<{ count: number; name: string }>
}

type ManifestNote = PublicGardenManifest['notes'][number]

const MARKDOWN_SUFFIX = '.md'

function digest(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex')
}

function gardenRoot(outputDirectory?: string) {
  return path.resolve(outputDirectory || process.env.PUBLIC_GARDEN_OUTPUT_DIR || 'content/public-garden')
}

function safeOutput(value: string, suffix?: string) {
  if (!value || value.includes('\\') || path.posix.isAbsolute(value)) return false
  const normalized = path.posix.normalize(value)
  if (normalized !== value || normalized.split('/').some((part) => !part || part === '..' || part.startsWith('.'))) return false
  return suffix ? value.endsWith(suffix) : true
}

async function readManifest(root: string): Promise<PublicGardenManifest | null> {
  const manifestPath = path.join(root, 'manifest.json')
  const stat = await lstat(manifestPath).catch(() => null)
  if (!stat) return null
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('PUBLIC_GARDEN_MANIFEST_INVALID')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Partial<PublicGardenManifest>
  if (manifest.version !== 1 || !Array.isArray(manifest.notes) || !Array.isArray(manifest.attachments)) {
    throw new Error('PUBLIC_GARDEN_MANIFEST_INVALID')
  }
  for (const note of manifest.notes) {
    if (!safeOutput(note.output, MARKDOWN_SUFFIX) || !/^[a-f0-9]{64}$/.test(note.sha256)) throw new Error('PUBLIC_GARDEN_MANIFEST_INVALID')
  }
  for (const attachment of manifest.attachments) {
    if (!safeOutput(attachment.output) || !/^[a-f0-9]{64}$/.test(attachment.sha256)) throw new Error('PUBLIC_GARDEN_MANIFEST_INVALID')
  }
  return manifest as PublicGardenManifest
}

async function readVerifiedFile(root: string, output: string, expectedSha256: string) {
  if (!safeOutput(output)) throw new Error('PUBLIC_GARDEN_PATH_INVALID')
  let current = root
  for (const part of output.split('/')) {
    current = path.join(current, part)
    const stat = await lstat(current).catch(() => null)
    if (!stat || stat.isSymbolicLink()) throw new Error('PUBLIC_GARDEN_FILE_MISSING')
  }
  const stat = await lstat(current)
  if (!stat.isFile()) throw new Error('PUBLIC_GARDEN_FILE_INVALID')
  const resolved = await realpath(current)
  const relative = path.relative(root, resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('PUBLIC_GARDEN_PATH_INVALID')
  const bytes = await readFile(resolved)
  if (digest(bytes) !== expectedSha256) throw new Error('PUBLIC_GARDEN_CHECKSUM_MISMATCH')
  return bytes
}

function textContent(node: { children?: unknown[]; type?: string; value?: string }): string {
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') return node.value || ''
  return (node.children || []).map((child) => textContent(child as typeof node)).join('')
}

export function gardenHeadingId(value: string, seen = new Map<string, number>()) {
  const base = value
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'section'
  const count = seen.get(base) || 0
  seen.set(base, count + 1)
  return count ? `${base}-${count + 1}` : base
}

export function gardenNoteUrl(output: string) {
  const withoutSuffix = output.slice(0, -MARKDOWN_SUFFIX.length)
  return withoutSuffix === 'index' ? '/garden' : `/garden/${withoutSuffix.split('/').map(encodeURIComponent).join('/')}`
}

function resolveOutput(currentOutput: string, href: string) {
  let decoded: string
  try { decoded = decodeURIComponent(href.split(/[?#]/, 1)[0] || '') } catch { return null }
  if (!decoded || decoded.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(decoded) || decoded.startsWith('//')) return null
  if (decoded.includes('\\') || path.posix.isAbsolute(decoded)) return null
  const output = path.posix.normalize(path.posix.join(path.posix.dirname(currentOutput), decoded))
  if (output === '..' || output.startsWith('../')) return null
  return output
}

export function resolveGardenHref(currentOutput: string, href: string, manifest: PublicGardenManifest) {
  const hash = href.includes('#') ? `#${href.split('#').slice(1).join('#')}` : ''
  const output = resolveOutput(currentOutput, href)
  if (!output) return href
  const note = manifest.notes.find((entry) => entry.output === output || entry.output === `${output}.md`)
  if (note) return `${gardenNoteUrl(note.output)}${hash}`
  const attachment = manifest.attachments.find((entry) => entry.output === output)
  if (attachment) return `/garden/files/${attachment.output.split('/').map(encodeURIComponent).join('/')}`
  return '#unavailable'
}

function noteMetadata(source: string, manifestNote: ManifestNote) {
  const parsed = matter(source)
  const tree = unified().use(remarkParse).parse(parsed.content)
  const headings: GardenHeading[] = []
  const links: string[] = []
  const seen = new Map<string, number>()
  visit(tree, (node: { children?: unknown[]; depth?: number; type?: string; url?: string; value?: string }) => {
    if (node.type === 'heading' && node.depth && node.depth >= 2 && node.depth <= 4) {
      const title = textContent(node)
      headings.push({ depth: node.depth, id: gardenHeadingId(title, seen), title })
    }
    if (node.type === 'link' && node.url) links.push(node.url)
  })
  const tags = Array.isArray(parsed.data.tags)
    ? parsed.data.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map((tag) => tag.trim())
    : []
  return {
    body: parsed.content,
    date: typeof parsed.data.date === 'string' ? parsed.data.date : undefined,
    description: typeof parsed.data.description === 'string' ? parsed.data.description.trim() : undefined,
    headings,
    links,
    output: manifestNote.output,
    sha256: manifestNote.sha256,
    tags,
    title: manifestNote.title,
    updatedAt: parsed.data.date instanceof Date ? parsed.data.date.toISOString() : typeof parsed.data.date === 'string' ? parsed.data.date : '',
    url: gardenNoteUrl(manifestNote.output),
  }
}

export async function getPublicGarden(outputDirectory?: string): Promise<GardenIndex> {
  const root = gardenRoot(outputDirectory)
  const rootStat = await lstat(root).catch(() => null)
  if (!rootStat) return { manifest: null, notes: [], tags: [] }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('PUBLIC_GARDEN_ROOT_INVALID')
  const resolvedRoot = await realpath(root)
  const manifest = await readManifest(resolvedRoot)
  if (!manifest) return { manifest: null, notes: [], tags: [] }

  const rawNotes = await Promise.all(manifest.notes.map(async (entry) => {
    const bytes = await readVerifiedFile(resolvedRoot, entry.output, entry.sha256)
    return noteMetadata(bytes.toString('utf8'), entry)
  }))
  const byOutput = new Map(rawNotes.map((note) => [note.output, note]))
  const backlinks = new Map(rawNotes.map((note) => [note.output, new Map<string, { title: string; url: string }>()]))
  for (const source of rawNotes) {
    for (const href of source.links) {
      const output = resolveOutput(source.output, href)
      const target = output ? byOutput.get(output) || byOutput.get(`${output}.md`) : undefined
      if (target && target.output !== source.output) backlinks.get(target.output)?.set(source.output, { title: source.title, url: source.url })
    }
  }
  const notes: GardenNote[] = rawNotes.map(({ links: _links, ...note }) => ({
    ...note,
    backlinks: [...(backlinks.get(note.output)?.values() || [])].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')),
  }))
  const counts = new Map<string, number>()
  for (const note of notes) for (const tag of note.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
  return {
    generatedAt: manifest.generatedAt,
    manifest,
    notes: notes.sort((a, b) => a.output.localeCompare(b.output)),
    tags: [...counts].map(([name, count]) => ({ count, name })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
  }
}

export async function getPublicGardenNote(slug: string[], outputDirectory?: string) {
  const output = `${slug.join('/') || 'index'}.md`
  const garden = await getPublicGarden(outputDirectory)
  return { garden, note: garden.notes.find((entry) => entry.output === output) || null }
}

export async function readPublicGardenAttachment(output: string, outputDirectory?: string) {
  const root = gardenRoot(outputDirectory)
  const rootStat = await lstat(root).catch(() => null)
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) return null
  const resolvedRoot = await realpath(root)
  const manifest = await readManifest(resolvedRoot)
  const entry = manifest?.attachments.find((attachment) => attachment.output === output)
  if (!entry) return null
  return { bytes: await readVerifiedFile(resolvedRoot, entry.output, entry.sha256), entry }
}
