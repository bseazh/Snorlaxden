import type { CollectionConfig } from 'payload'

import { authenticated, enabledForPublic } from '../access'
import { auditCollectionHooks } from '../modules/audit'

export const FAQItems: CollectionConfig = {
  slug: 'faq-items',
  admin: {
    defaultColumns: ['question', 'enabled', 'sortOrder', 'updatedAt'],
    useAsTitle: 'question',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: enabledForPublic,
    update: authenticated,
  },
  defaultSort: 'sortOrder',
  hooks: auditCollectionHooks('faq'),
  fields: [
    { name: 'question', type: 'text', required: true },
    { name: 'answer', type: 'textarea', required: true },
    { name: 'sortOrder', type: 'number', defaultValue: 100, required: true },
    { name: 'relatedUrl', type: 'text' },
    { name: 'enabled', type: 'checkbox', defaultValue: true, index: true },
  ],
}
