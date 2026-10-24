import type { CollectionConfig } from 'payload'

import { authenticated, authenticatedOrPublicMedia } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublicMedia,
    update: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'purpose',
      type: 'select',
      defaultValue: 'other',
      options: [
        { label: '个人照片', value: 'original_photo' },
        { label: 'AI 图片', value: 'ai_image' },
        { label: '缩略图', value: 'thumbnail' },
        { label: '其他', value: 'other' },
      ],
      required: true,
    },
    {
      name: 'visibility',
      type: 'select',
      defaultValue: 'private',
      index: true,
      options: [
        { label: '私有', value: 'private' },
        { label: '公开', value: 'public' },
      ],
      required: true,
    },
    {
      name: 'licenseNote',
      type: 'textarea',
    },
  ],
  upload: {
    adminThumbnail: 'card',
    imageSizes: [
      { name: 'card', width: 720, height: 480, position: 'centre' },
      { name: 'wide', width: 1440, height: 810, position: 'centre' },
    ],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    pasteURL: false,
  },
}
