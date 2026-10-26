import { createHash, randomUUID } from 'node:crypto'

import type { Payload, RequiredDataFromCollectionSlug } from 'payload'

import type { User } from '@/payload-types'

import { writeAuditLog, type AuditRequestContext } from '../audit'
import { normalizeResourceURL, ResourceError } from '../resources'
import { SourceMaterialError, parseRelationshipIds, validateSourceMaterialFile } from './domain'
import { getPrivateStorage } from './storage'

const BASIS = new Set(['owned', 'permission', 'open_license', 'public_domain'])
const MATERIAL_TYPES = new Set(['pdf', 'owned_image', 'authorized_original'])

function stringField(form: FormData, key: string, required = false) {
  const value = form.get(key)
  if (typeof value !== 'string' || !value.trim()) {
    if (required) throw new SourceMaterialError('VALIDATION_ERROR', `${key} 为必填项。`, 400)
    return undefined
  }
  return value.trim()
}

export async function uploadSourceMaterial(
  payload: Payload,
  user: User,
  form: FormData,
  request: AuditRequestContext,
) {
  const file = form.get('file')
  if (!(file instanceof File)) throw new SourceMaterialError('FILE_REQUIRED', '请选择要上传的文件。', 400)

  const title = stringField(form, 'title', true)!
  const authorizationBasis = stringField(form, 'authorizationBasis', true)!
  const authorizationNote = stringField(form, 'authorizationNote', true)!
  const requestedType = stringField(form, 'materialType')
  if (!BASIS.has(authorizationBasis)) throw new SourceMaterialError('VALIDATION_ERROR', '授权依据无效。', 400)

  const buffer = new Uint8Array(await file.arrayBuffer())
  const { extension, mimeType } = validateSourceMaterialFile(buffer, file.type)
  const materialType = (requestedType || (mimeType === 'application/pdf' ? 'pdf' : 'owned_image')) as 'authorized_original' | 'owned_image' | 'pdf'
  if (!MATERIAL_TYPES.has(materialType)) throw new SourceMaterialError('VALIDATION_ERROR', '材料类型无效。', 400)

  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const duplicate = await payload.find({
    collection: 'source-materials',
    limit: 1,
    overrideAccess: true,
    where: { sha256: { equals: sha256 } },
  })
  if (duplicate.totalDocs > 0) throw new SourceMaterialError('DUPLICATE_FILE', '相同文件已经上传。', 409)

  const rawSourceUrl = stringField(form, 'sourceUrl')
  let sourceUrl: string | undefined
  try {
    sourceUrl = rawSourceUrl ? normalizeResourceURL(rawSourceUrl).canonicalUrl : undefined
  } catch (error) {
    if (error instanceof ResourceError) throw new SourceMaterialError(error.code, error.message, error.status)
    throw error
  }
  const storage = getPrivateStorage()
  const stored = await storage.put({ buffer, extension, mimeType, sha256 })

  const data = {
    author: user.id,
    authorizationBasis: authorizationBasis as 'open_license' | 'owned' | 'permission' | 'public_domain',
    authorizationNote,
    authorizedText: stringField(form, 'authorizedText'),
    byteSize: buffer.byteLength,
    capturedAt: new Date().toISOString(),
    materialType,
    mimeType,
    originalFileName: file.name.slice(0, 240),
    personalNotes: stringField(form, 'personalNotes'),
    posts: parseRelationshipIds(form.get('posts')),
    privacy: 'private',
    projects: parseRelationshipIds(form.get('projects')),
    resources: parseRelationshipIds(form.get('resources')),
    sha256,
    sourceAuthor: stringField(form, 'sourceAuthor'),
    sourceDescription: stringField(form, 'sourceDescription'),
    sourceId: `source-${randomUUID()}`,
    sourceTitle: stringField(form, 'sourceTitle'),
    sourceUrl,
    storageDriver: stored.driver,
    storageKey: stored.key,
    title,
  } satisfies RequiredDataFromCollectionSlug<'source-materials'>
  let material
  try {
    material = await payload.create({
      collection: 'source-materials',
      context: { skipAudit: true },
      data,
      overrideAccess: true,
    })
  } catch (error) {
    await storage.delete(stored.key).catch((cleanupError) => payload.logger.error({ err: cleanupError, msg: 'Source material upload cleanup failed' }))
    if (String((error as Error).message).toLowerCase().includes('unique')) {
      throw new SourceMaterialError('DUPLICATE_FILE', '相同文件已经上传。', 409)
    }
    throw error
  }

  try {
    await writeAuditLog(payload, {
      action: 'source-material.uploaded',
      actorId: user.id,
      metadata: { byteSize: buffer.byteLength, mimeType, storageDriver: stored.driver },
      request,
      resourceId: material.id,
      resourceType: 'source-material',
    })
  } catch (error) {
    await payload.delete({ collection: 'source-materials', context: { skipAudit: true }, id: material.id, overrideAccess: true })
      .catch((cleanupError) => payload.logger.error({ err: cleanupError, msg: 'Source material rollback after audit failure failed' }))
    throw error
  }
  return material
}

export function privateDownloadHeaders(contentType?: string | null, fileName?: string | null) {
  const safeName = (fileName || 'attachment').replaceAll(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'attachment'
  const encodedName = encodeURIComponent((fileName || 'attachment').replaceAll(/[\r\n]/g, '')).replaceAll("'", '%27')
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    'Content-Type': contentType || 'application/octet-stream',
    'Pragma': 'no-cache',
    'Vary': 'Cookie, Authorization',
    'X-Content-Type-Options': 'nosniff',
  }
}
