import type { CollectionConfig } from 'payload'

import { authenticated, authenticatedOrPublished } from '../access'
import { seoFields } from '../fields/seo'
import { auditCollectionHooks } from '../modules/audit'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    defaultColumns: ['title', '_status', 'publishedAt', 'updatedAt'],
    useAsTitle: 'title',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  defaultSort: '-publishedAt',
  hooks: auditCollectionHooks('post'),
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', index: true, required: true, unique: true },
    { name: 'summary', type: 'textarea', required: true, maxLength: 320 },
    { name: 'content', type: 'richText', required: true },
    {
      name: 'contentType',
      type: 'select',
      defaultValue: 'essay',
      options: [
        { label: '复盘', value: 'reflection' },
        { label: '随笔', value: 'essay' },
        { label: '知识', value: 'knowledge' },
        { label: '项目笔记', value: 'project-note' },
      ],
      required: true,
    },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'tags', type: 'relationship', hasMany: true, relationTo: 'tags' },
    { name: 'isFeatured', type: 'checkbox', defaultValue: false },
    { name: 'publishedAt', type: 'date', index: true },
    {
      name: 'reviewState',
      type: 'select',
      defaultValue: 'editing',
      options: [
        { label: '编辑中', value: 'editing' },
        { label: '待审核', value: 'needs_review' },
        { label: '已批准', value: 'approved' },
        { label: '已归档', value: 'archived' },
      ],
      required: true,
    },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    { name: 'aiDisclosure', type: 'checkbox', defaultValue: false },
    { name: 'aiGeneration', type: 'relationship', relationTo: 'ai-generations' },
    { name: 'originalUrl', type: 'text' },
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
