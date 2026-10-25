import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'
import { auditCollectionHooks } from '../modules/audit'
import { cleanupDeletedSourceMaterialObject, prepareSourceMaterial } from '../modules/source-materials'
import { normalizeResourceURL } from '../modules/resources'

const auditHooks = auditCollectionHooks('source-material')

export const SourceMaterials: CollectionConfig = {
  slug: 'source-materials',
  labels: { plural: '来源材料', singular: '来源材料' },
  admin: {
    defaultColumns: ['title', 'materialType', 'mimeType', 'byteSize', 'capturedAt'],
    description: '仅管理员可见。原始材料不会随关联文章或项目公开。',
    group: '第二知识仓库',
    useAsTitle: 'title',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  defaultSort: '-capturedAt',
  hooks: {
    ...auditHooks,
    afterDelete: [...(auditHooks.afterDelete || []), cleanupDeletedSourceMaterialObject],
    beforeValidate: [prepareSourceMaterial],
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 180 },
    {
      name: 'materialType', type: 'select', defaultValue: 'typed_note', required: true, index: true,
      options: [
        { label: '个人笔记', value: 'typed_note' },
        { label: 'PDF 文档', value: 'pdf' },
        { label: '本人图片', value: 'owned_image' },
        { label: '授权原始材料', value: 'authorized_original' },
      ],
    },
    { name: 'sourceId', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'personalNotes', type: 'textarea', label: '个人笔记', maxLength: 20000 },
    { name: 'sourceDescription', type: 'textarea', label: '来源说明', maxLength: 5000 },
    { name: 'authorizedText', type: 'textarea', label: '明确获授权的原文', maxLength: 50000 },
    {
      name: 'authorizationBasis', type: 'select', required: true,
      options: [
        { label: '本人原创或拥有', value: 'owned' },
        { label: '已获明确许可', value: 'permission' },
        { label: '开放许可', value: 'open_license' },
        { label: '公有领域', value: 'public_domain' },
      ],
    },
    { name: 'authorizationNote', type: 'textarea', label: '授权说明', required: true, maxLength: 3000 },
    {
      name: 'sourceUrl', type: 'text', label: '来源 URL', maxLength: 2000,
      validate: (value: null | string | undefined) => {
        if (!value) return true
        try { normalizeResourceURL(value); return true } catch (error) { return error instanceof Error ? error.message : 'URL 不安全。' }
      },
    },
    { name: 'sourceTitle', type: 'text', label: '来源标题', maxLength: 300 },
    { name: 'sourceAuthor', type: 'text', label: '来源作者', maxLength: 180 },
    { name: 'sourceDate', type: 'date', label: '来源日期' },
    { name: 'capturedAt', type: 'date', defaultValue: () => new Date().toISOString(), required: true, index: true },
    { name: 'resources', type: 'relationship', hasMany: true, relationTo: 'resources', label: '关联资源' },
    { name: 'posts', type: 'relationship', hasMany: true, relationTo: 'posts', label: '关联文章' },
    { name: 'projects', type: 'relationship', hasMany: true, relationTo: 'projects', label: '关联项目' },
    { name: 'author', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'privacy', type: 'select', defaultValue: 'private', required: true, index: true,
      options: [{ label: '私有', value: 'private' }],
      admin: { readOnly: true },
    },
    { name: 'originalFileName', type: 'text', admin: { readOnly: true } },
    { name: 'mimeType', type: 'text', admin: { readOnly: true }, index: true },
    { name: 'byteSize', type: 'number', admin: { readOnly: true } },
    { name: 'sha256', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    { name: 'storageDriver', type: 'select', options: [{ label: '本地私有目录', value: 'local' }, { label: '腾讯云 COS', value: 'cos' }], admin: { readOnly: true } },
    { name: 'storageKey', type: 'text', unique: true, admin: { hidden: true, readOnly: true } },
  ],
}
