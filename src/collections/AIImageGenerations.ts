import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

export const AIImageGenerations: CollectionConfig = {
  slug: 'ai-image-generations',
  labels: { plural: 'AI 图片任务', singular: 'AI 图片任务' },
  admin: {
    defaultColumns: ['post', 'provider', 'model', 'status', 'createdAt'],
    description: '候选图保持私有；人工选择后才进入 Media，并且只绑定文章草稿。',
    group: 'AI 工作台',
    useAsTitle: 'idempotencyKey',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'creator', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'post', type: 'relationship', relationTo: 'posts', required: true, index: true },
    { name: 'referenceMaterial', type: 'relationship', relationTo: 'source-materials', required: true, index: true },
    {
      name: 'provider', type: 'select', required: true,
      options: [
        { label: 'SophNet', value: 'sophnet' },
        { label: 'QMG2S', value: 'qmg2s' },
      ],
    },
    { name: 'model', type: 'text', required: true },
    { name: 'promptVersion', type: 'text', required: true },
    {
      name: 'status', type: 'select', defaultValue: 'queued', required: true, index: true,
      options: [
        { label: '排队中', value: 'queued' },
        { label: '生成中', value: 'running' },
        { label: '部分成功', value: 'partially_succeeded' },
        { label: '成功', value: 'succeeded' },
        { label: '失败', value: 'failed' },
        { label: '已取消', value: 'cancelled' },
        { label: '已选用', value: 'selected' },
      ],
    },
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true },
    { name: 'prompt', type: 'textarea', required: true },
    { name: 'request', type: 'json', required: true },
    { name: 'candidates', type: 'json' },
    { name: 'requestedCount', type: 'number', defaultValue: 1, min: 1, max: 4, required: true },
    { name: 'generationCallCount', type: 'number', defaultValue: 0, required: true, admin: { readOnly: true } },
    { name: 'retryCount', type: 'number', defaultValue: 0, required: true },
    { name: 'usage', type: 'json' },
    { name: 'errorCode', type: 'text' },
    { name: 'errorMessage', type: 'text' },
    { name: 'selectedCandidateId', type: 'text' },
    { name: 'selectedMedia', type: 'relationship', relationTo: 'media' },
  ],
}
