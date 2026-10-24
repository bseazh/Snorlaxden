import type { CollectionConfig } from 'payload'

import { authenticated, authenticatedOrPublished } from '../access'
import { seoFields } from '../fields/seo'
import { auditCollectionHooks } from '../modules/audit'

export const Projects: CollectionConfig = {
  slug: 'projects',
  admin: {
    defaultColumns: ['title', '_status', 'isFeatured', 'updatedAt'],
    useAsTitle: 'title',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  defaultSort: 'sortOrder',
  hooks: auditCollectionHooks('project'),
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', index: true, required: true, unique: true },
    { name: 'overview', type: 'textarea', required: true },
    { name: 'content', type: 'richText', required: true },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'tags', type: 'relationship', hasMany: true, relationTo: 'tags' },
    { name: 'isFeatured', type: 'checkbox', defaultValue: false },
    { name: 'sortOrder', type: 'number', defaultValue: 100, required: true },
    {
      name: 'links',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    { name: 'startedAt', type: 'date' },
    { name: 'endedAt', type: 'date' },
    seoFields,
  ],
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
    },
    maxPerDoc: 30,
  },
}
