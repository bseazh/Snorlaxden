import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

export const AIGenerations: CollectionConfig = {
  slug: 'ai-generations',
  admin: {
    defaultColumns: ['provider', 'model', 'status', 'createdAt'],
    group: 'AI 工作台',
    useAsTitle: 'sourceHash',
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
    {
      name: 'provider',
      type: 'select',
      options: [
        { label: 'DeepSeek', value: 'deepseek' },
        { label: '阶跃星辰', value: 'stepfun' },
      ],
      required: true,
    },
    { name: 'model', type: 'text', required: true },
    { name: 'promptVersion', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'running',
      index: true,
      options: [
        { label: '生成中', value: 'running' },
        { label: '成功', value: 'succeeded' },
        { label: '失败', value: 'failed' },
        { label: '已保存为草稿', value: 'saved_as_draft' },
      ],
      required: true,
    },
    { name: 'sourceHash', type: 'text', required: true, index: true },
    { name: 'sourceText', type: 'textarea', required: true },
    { name: 'verifiedFacts', type: 'textarea' },
    { name: 'request', type: 'json', required: true },
    { name: 'result', type: 'json' },
    { name: 'errorCode', type: 'text' },
    { name: 'errorMessage', type: 'text' },
    { name: 'savedPost', type: 'relationship', relationTo: 'posts' },
    { name: 'markdownPath', type: 'text' },
  ],
}
