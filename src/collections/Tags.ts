import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    defaultColumns: ['name', 'slug', 'updatedAt'],
    useAsTitle: 'name',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: () => true,
    update: authenticated,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', index: true, required: true, unique: true },
    { name: 'description', type: 'textarea' },
  ],
}

