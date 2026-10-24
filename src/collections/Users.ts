import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'
import { auditCollectionHooks, writeAuditLog } from '../modules/audit'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'admin',
      options: [{ label: '管理员', value: 'admin' }],
      required: true,
    },
  ],
  hooks: {
    ...auditCollectionHooks('user'),
    afterLogin: [async ({ req, user }) => {
      await writeAuditLog(req.payload, {
        action: 'auth.login',
        actorId: user.id,
        request: req,
        resourceId: user.id,
        resourceType: 'user',
      })
      return user
    }],
    afterLogout: [async ({ req }) => {
      await writeAuditLog(req.payload, {
        action: 'auth.logout',
        actorId: req.user?.id,
        request: req,
        resourceId: req.user?.id,
        resourceType: 'user',
      })
    }],
  },
}
