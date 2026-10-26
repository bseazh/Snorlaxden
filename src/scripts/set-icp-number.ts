import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../payload.config'
import { writeAuditLog } from '../modules/audit'

const icpNumber = process.env.ICP_NUMBER?.trim()
if (!icpNumber || !/^粤ICP备\d+号$/.test(icpNumber)) throw new Error('ICP_NUMBER_INVALID')

const payload = await getPayload({ config })
try {
  await payload.updateGlobal({
    context: { skipAudit: true },
    data: { icpNumber },
    overrideAccess: true,
    slug: 'site-settings',
  })
  await writeAuditLog(payload, {
    action: 'site-settings.icp-updated',
    metadata: { source: 'owner-confirmed-production-operation' },
    resourceType: 'site-settings',
  })
  payload.logger.info('ICP number updated and audited.')
} finally {
  await payload.destroy()
}
