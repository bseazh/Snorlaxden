import type { Field } from 'payload'

export const seoFields: Field = {
  name: 'seo',
  type: 'group',
  fields: [
    {
      name: 'title',
      type: 'text',
      maxLength: 70,
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 180,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}

