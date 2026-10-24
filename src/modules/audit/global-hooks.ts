import type { GlobalAfterChangeHook } from 'payload'

import { writeAuditLog } from './audit-service'

export function auditGlobalHooks(resourceType: string) {
  const afterChange: GlobalAfterChangeHook = async ({ context, doc, req }) => {
    if (context.skipAudit || !req.user) return doc
    await writeAuditLog(req.payload, {
      action: `${resourceType}.updated`,
      actorId: req.user.id,
      request: req,
      resourceType,
    })
    return doc
  }

  return { afterChange: [afterChange] }
}
