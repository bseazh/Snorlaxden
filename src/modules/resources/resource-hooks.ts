import { randomUUID } from 'node:crypto'

import type { CollectionBeforeValidateHook } from 'payload'

import type { Resource } from '../../payload-types'
import { normalizeResourceURL } from './normalize-resource-url'

export const prepareResource: CollectionBeforeValidateHook<Resource> = ({ data, operation }) => {
  if (!data) return data
  if (operation === 'create' && !data.sourceId) data.sourceId = randomUUID()
  if (data.sourceUrl === undefined) return data

  const sourceUrl = data.sourceUrl?.trim()
  if (!sourceUrl) {
    data.sourceUrl = null
    data.canonicalUrl = null
    data.externalId = null
    data.platform = null
    data.sourceKey = null
    return data
  }

  const normalized = normalizeResourceURL(sourceUrl)
  data.sourceUrl = sourceUrl
  data.canonicalUrl = normalized.canonicalUrl
  data.externalId = normalized.externalId || null
  data.platform = normalized.platform
  data.sourceKey = normalized.sourceKey
  return data
}
