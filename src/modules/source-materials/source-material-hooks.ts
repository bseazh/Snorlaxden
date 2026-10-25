import { randomUUID } from 'node:crypto'

import type { CollectionAfterDeleteHook, CollectionBeforeValidateHook } from 'payload'

import { normalizeResourceURL } from '../resources'
import { getPrivateStorage } from './storage'

export const prepareSourceMaterial: CollectionBeforeValidateHook = ({ data, operation, req }) => {
  if (!data) return data
  if (operation === 'create') {
    data.sourceId ||= `source-${randomUUID()}`
    data.privacy = 'private'
    data.author ||= req.user?.id
  }
  if (data.sourceUrl) data.sourceUrl = normalizeResourceURL(String(data.sourceUrl)).canonicalUrl
  return data
}

export const cleanupDeletedSourceMaterialObject: CollectionAfterDeleteHook = async ({ doc }) => {
  if (!doc.storageKey) return doc
  await getPrivateStorage(doc.storageDriver).delete(doc.storageKey)
  return doc
}
