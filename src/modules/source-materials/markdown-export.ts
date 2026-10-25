import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'

import type { User } from '@/payload-types'

import { writeAuditLog, type AuditRequestContext } from '../audit'
import { SourceMaterialError } from './domain'

type ExportType = 'resource' | 'source-material'

function yamlString(value: unknown) {
  return JSON.stringify(String(value ?? ''))
}

function section(title: string, value?: string | null) {
  return `## ${title}\n\n${value?.trim() || '_未填写_'}\n`
}

export function renderSourceMaterialMarkdown(material: {
  authorizationBasis: string
  authorizationNote: string
  authorizedText?: string | null
  capturedAt: string
  personalNotes?: string | null
  sourceAuthor?: string | null
  sourceDescription?: string | null
  sourceId: string
  sourceTitle?: string | null
  sourceUrl?: string | null
  title: string
}) {
  const frontmatter = [
    '---',
    `title: ${yamlString(material.title)}`,
    `source_id: ${yamlString(material.sourceId)}`,
    'resource_type: "source-material"',
    `source_url: ${yamlString(material.sourceUrl)}`,
    `source_title: ${yamlString(material.sourceTitle)}`,
    `source_author: ${yamlString(material.sourceAuthor)}`,
    `collected_at: ${yamlString(material.capturedAt)}`,
    'visibility: "private"',
    `authorization_basis: ${yamlString(material.authorizationBasis)}`,
    `exported_at: ${yamlString(new Date().toISOString())}`,
    '---',
    '',
  ].join('\n')
  return `${frontmatter}# ${material.title}\n\n${section('个人笔记', material.personalNotes)}\n${section('来源说明', material.sourceDescription)}\n${section('授权说明', material.authorizationNote)}\n${section('已授权文字', material.authorizedText)}`
}

export function renderResourceMarkdown(resource: {
  capturedAt: string
  notes?: string | null
  sourceAccess: string
  sourceDescription?: string | null
  sourceId: string
  sourceUrl?: string | null
  title: string
}) {
  const frontmatter = [
    '---', `title: ${yamlString(resource.title)}`, `source_id: ${yamlString(resource.sourceId)}`,
    'resource_type: "resource"', `source_url: ${yamlString(resource.sourceUrl)}`,
    `collected_at: ${yamlString(resource.capturedAt)}`, 'visibility: "private"',
    `source_access: ${yamlString(resource.sourceAccess)}`, `exported_at: ${yamlString(new Date().toISOString())}`,
    '---', '',
  ].join('\n')
  return `${frontmatter}# ${resource.title}\n\n${section('个人笔记', resource.notes)}\n${section('来源说明', resource.sourceDescription)}\n${section('授权说明', `来源访问依据：${resource.sourceAccess}`)}\n${section('已授权文字', null)}`
}

async function persistWithoutOverwrite(type: ExportType, stableId: string, markdown: string) {
  const root = path.resolve(process.env.CONTENT_EXPORT_DIR || 'content/exports')
  const folder = path.resolve(root, `${type}s`)
  if (!folder.startsWith(`${root}${path.sep}`)) throw new SourceMaterialError('INVALID_EXPORT_PATH', '导出目录无效。', 500)
  await mkdir(folder, { recursive: true })
  const baseName = stableId.replaceAll(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100)
  const filePath = path.join(folder, `${baseName}.md`)
  try {
    await writeFile(filePath, markdown, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    return filePath
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const existing = await readFile(filePath, 'utf8')
    if (existing === markdown) return filePath
    const conflictPath = path.join(folder, `${baseName}.conflict-${Date.now()}.md`)
    await writeFile(conflictPath, markdown, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    return conflictPath
  }
}

export async function exportPrivateMarkdown(payload: Payload, user: User, type: ExportType, id: number | string, request: AuditRequestContext) {
  let markdown: string
  let stableId: string
  if (type === 'source-material') {
    const material = await payload.findByID({ collection: 'source-materials', id, overrideAccess: true })
    markdown = renderSourceMaterialMarkdown(material)
    stableId = material.sourceId
  } else if (type === 'resource') {
    const resource = await payload.findByID({ collection: 'resources', id, overrideAccess: true })
    markdown = renderResourceMarkdown(resource)
    stableId = resource.sourceId
  } else {
    throw new SourceMaterialError('INVALID_EXPORT_TYPE', '不支持该导出类型。', 400)
  }
  const filePath = await persistWithoutOverwrite(type, stableId, markdown)
  const sha256 = createHash('sha256').update(markdown).digest('hex')
  await writeAuditLog(payload, {
    action: `${type}.markdown_exported`, actorId: user.id,
    metadata: { markdownSha256: sha256 }, request, resourceId: id, resourceType: type,
  })
  return { fileName: path.basename(filePath), markdown, sha256 }
}
