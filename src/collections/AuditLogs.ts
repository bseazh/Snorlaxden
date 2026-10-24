import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    defaultColumns: ['action', 'outcome', 'resourceType', 'resourceId', 'createdAt'],
    group: '系统审计',
    useAsTitle: 'action',
  },
  access: {
    create: () => false,
    delete: () => false,
    read: authenticated,
    update: () => false,
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'actor', type: 'relationship', relationTo: 'users', index: true },
    { name: 'action', type: 'text', required: true, index: true },
    {
      name: 'outcome',
      type: 'select',
      defaultValue: 'success',
      options: [
        { label: '成功', value: 'success' },
        { label: '拒绝', value: 'denied' },
        { label: '失败', value: 'failure' },
      ],
      required: true,
    },
    { name: 'resourceType', type: 'text', required: true, index: true },
    { name: 'resourceId', type: 'text', index: true },
    { name: 'requestId', type: 'text', required: true, index: true },
    { name: 'ipHash', type: 'text' },
    { name: 'metadata', type: 'json' },
  ],
}
