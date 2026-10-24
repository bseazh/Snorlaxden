import type { GlobalConfig } from 'payload'

import { authenticated } from '../access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
    update: authenticated,
  },
  fields: [
    { name: 'displayName', type: 'text', defaultValue: '何海钊', required: true },
    { name: 'roleTitle', type: 'text', defaultValue: '人工智能硕士', required: true },
    { name: 'tagline', type: 'text', required: true },
    { name: 'bioShort', type: 'textarea', required: true },
    { name: 'bioLong', type: 'richText', required: true },
    { name: 'contactEmail', type: 'email', required: true },
    { name: 'heroMedia', type: 'upload', relationTo: 'media' },
    {
      name: 'socialLinks',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    { name: 'seoTitle', type: 'text', required: true },
    { name: 'seoDescription', type: 'textarea', required: true },
    { name: 'gardenUrl', type: 'text' },
    { name: 'icpNumber', type: 'text' },
  ],
}

