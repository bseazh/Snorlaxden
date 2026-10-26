import { randomUUID } from 'node:crypto'

import type { Payload, PayloadRequest, TypedUser } from 'payload'
import { createLocalReq } from 'payload'

import type { ResourceType, ResourceVisibility } from './domain'
import { RESOURCE_TYPES, RESOURCE_VISIBILITIES, ResourceError } from './domain'
import { normalizeResourceURL } from './normalize-resource-url'

export type CreateResourceInput = {
  notes?: string
  resourceType: ResourceType
  sourceUrl?: string
  title: string
  visibility: ResourceVisibility
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function validateCreateResourceInput(input: Record<string, unknown>): CreateResourceInput {
  const title = cleanText(input.title, 180)
  const notes = cleanText(input.notes, 12000)
  const sourceUrl = cleanText(input.sourceUrl, 2048)
  const resourceType = input.resourceType
  const visibility = input.visibility ?? 'private'
  if (!title) throw new ResourceError('INVALID_INPUT', '请填写资源标题。')
  if (!RESOURCE_TYPES.includes(resourceType as ResourceType)) throw new ResourceError('INVALID_INPUT', '资源类型无效。')
  if (!RESOURCE_VISIBILITIES.includes(visibility as ResourceVisibility)) throw new ResourceError('INVALID_INPUT', '可见性无效。')
  if (!sourceUrl && !notes) throw new ResourceError('INVALID_INPUT', 'URL 和个人笔记至少填写一项。')
  if (sourceUrl) normalizeResourceURL(sourceUrl)
  return { notes: notes || undefined, resourceType: resourceType as ResourceType, sourceUrl: sourceUrl || undefined, title, visibility: visibility as ResourceVisibility }
}

export async function createResource(
  payload: Payload,
  user: TypedUser,
  input: CreateResourceInput,
  request?: Pick<PayloadRequest, 'headers'>,
) {
  if (input.sourceUrl) {
    const { sourceKey } = normalizeResourceURL(input.sourceUrl)
    const existing = await payload.find({
      collection: 'resources', limit: 1, overrideAccess: true,
      where: { sourceKey: { equals: sourceKey } },
    })
    if (existing.totalDocs) throw new ResourceError('DUPLICATE_RESOURCE', '这个 URL 已经收藏过了。', 409)
  }
  const req = await createLocalReq({ req: request, user }, payload)
  return payload.create({
    collection: 'resources',
    data: {
      capturedAt: new Date().toISOString(), ingestStatus: 'saved_only', notes: input.notes, resourceType: input.resourceType,
      owner: user.id,
      sourceId: randomUUID(),
      sourceAccess: input.sourceUrl ? 'url_only' : 'user_supplied_text', sourceUrl: input.sourceUrl,
      title: input.title, visibility: input.visibility,
    },
    overrideAccess: false,
    req,
  })
}
