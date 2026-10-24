import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { writeAuditLog } from './audit-service'

type AuditedDocument = {
  _status?: 'draft' | 'published' | null
  id: number | string
  slug?: string | null
}

function changeAction(resourceType: string, operation: 'create' | 'update', doc: AuditedDocument, previous?: AuditedDocument) {
  if (doc._status === 'published' && previous?._status !== 'published') return `${resourceType}.published`
  if (doc._status === 'draft' && previous?._status === 'published') return `${resourceType}.withdrawn`
  return `${resourceType}.${operation === 'create' ? 'created' : 'updated'}`
}

function changedFields(doc: AuditedDocument, previous?: AuditedDocument) {
  if (!previous) return undefined
  const ignored = new Set(['createdAt', 'updatedAt'])
  return Object.keys(doc)
    .filter((key) => !ignored.has(key) && JSON.stringify(doc[key as keyof AuditedDocument]) !== JSON.stringify(previous[key as keyof AuditedDocument]))
    .slice(0, 40)
    .join(',') || undefined
}

export function auditCollectionHooks(resourceType: string) {
  const afterChange: CollectionAfterChangeHook<AuditedDocument> = async ({ context, doc, operation, previousDoc, req }) => {
    if (context.skipAudit || !req.user) return doc
    await writeAuditLog(req.payload, {
      action: changeAction(resourceType, operation, doc, previousDoc),
      actorId: req.user.id,
      metadata: { changedFields: changedFields(doc, previousDoc), slug: doc.slug || undefined, status: doc._status || undefined },
      request: req,
      resourceId: doc.id,
      resourceType,
    })
    return doc
  }

  const afterDelete: CollectionAfterDeleteHook<AuditedDocument> = async ({ context, doc, id, req }) => {
    if (context.skipAudit || !req.user) return doc
    await writeAuditLog(req.payload, {
      action: `${resourceType}.deleted`,
      actorId: req.user.id,
      metadata: { slug: doc.slug || undefined },
      request: req,
      resourceId: id,
      resourceType,
    })
    return doc
  }

  return { afterChange: [afterChange], afterDelete: [afterDelete] }
}
