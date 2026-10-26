import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { authenticated } from '../access'
import { auditCollectionHooks } from '../modules/audit'
import { normalizeResourceURL, prepareResource } from '../modules/resources'

const assignResourceOwner: CollectionBeforeValidateHook = ({ data, operation, req }) => {
  if (!data) return data
  if (operation === 'create' && !data.owner && req.user) data.owner = req.user.id
  return data
}

export const Resources: CollectionConfig = {
  slug: 'resources',
  labels: { plural: '资源库', singular: '资源' },
  admin: {
    defaultColumns: ['title', 'resourceType', 'visibility', 'ingestStatus', 'capturedAt'],
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
    ...auditCollectionHooks('resource'),
    beforeValidate: [assignResourceOwner, prepareResource],
  },
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true, index: true, admin: { readOnly: true }, label: '所有者' },
    { name: 'title', type: 'text', required: true, maxLength: 180 },
    {
      name: 'resourceType', type: 'select', defaultValue: 'note', required: true, index: true,
      options: [
        { label: '短记', value: 'note' }, { label: '视频', value: 'video' },
        { label: '图书', value: 'book' }, { label: '图片', value: 'image' },
        { label: '活动记录', value: 'activity' }, { label: '网页链接', value: 'link' },
      ],
    },
    { name: 'notes', type: 'textarea', label: '个人笔记', maxLength: 12000 },
    { name: 'sourceDescription', type: 'textarea', label: '第三方来源说明', maxLength: 2000 },
    {
      name: 'sourceUrl', type: 'text', label: '原始 URL',
      validate: (value: null | string | undefined) => {
        if (!value) return true
        try { normalizeResourceURL(value); return true } catch (error) { return error instanceof Error ? error.message : 'URL 不安全。' }
      },
    },
    { name: 'canonicalUrl', type: 'text', label: '规范 URL', admin: { readOnly: true }, index: true },
    { name: 'sourceKey', type: 'text', admin: { hidden: true }, unique: true },
    { name: 'sourceId', type: 'text', label: '稳定来源 ID', admin: { readOnly: true }, required: true, unique: true },
    {
      name: 'platform', type: 'select', admin: { readOnly: true },
      options: [
        { label: 'Bilibili', value: 'bilibili' }, { label: 'YouTube', value: 'youtube' },
        { label: '微信视频号', value: 'wechat_channels' }, { label: '通用网页', value: 'web' },
      ],
    },
    { name: 'externalId', type: 'text', admin: { readOnly: true }, index: true },
    {
      name: 'sourceAccess', type: 'select', defaultValue: 'url_only', required: true,
      options: [
        { label: '仅保存 URL', value: 'url_only' }, { label: '仅元数据', value: 'metadata' },
        { label: '用户提供文字', value: 'user_supplied_text' }, { label: '已授权转录', value: 'authorized_transcript' },
        { label: '本人拥有媒体', value: 'self_owned_media' },
      ],
    },
    {
      name: 'ingestStatus', type: 'select', defaultValue: 'saved_only', required: true, index: true,
      options: [
        { label: '仅收藏', value: 'saved_only' }, { label: '元数据已就绪', value: 'metadata_ready' },
        { label: '文字已就绪', value: 'text_ready' }, { label: '知识卡草稿', value: 'card_draft' },
        { label: '已审核', value: 'reviewed' }, { label: '处理失败', value: 'failed' },
      ],
    },
    {
      name: 'visibility', type: 'select', defaultValue: 'private', required: true, index: true,
      options: [
        { label: '私有', value: 'private' }, { label: '待审核', value: 'review' }, { label: '公开候选', value: 'public' },
      ],
      admin: { description: '公开候选不等于已发布；ISSUE-005 不提供公开资源读取接口。' },
    },
    { name: 'tags', type: 'relationship', hasMany: true, relationTo: 'tags' },
    { name: 'relatedPosts', type: 'relationship', hasMany: true, relationTo: 'posts', label: '关联文章' },
    { name: 'relatedProjects', type: 'relationship', hasMany: true, relationTo: 'projects', label: '关联项目' },
    { name: 'capturedAt', type: 'date', defaultValue: () => new Date().toISOString(), required: true, index: true },
  ],
}
