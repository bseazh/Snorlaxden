import type { Payload } from 'payload'

import type { User } from '@/payload-types'

import { writeAuditLog, type AuditRequestContext } from '../audit'
import { PublicGardenError } from './domain'
import { exportPublicGarden, loadPublicGardenConfig } from './exporter'

export async function exportConfiguredPublicGarden(payload: Payload, user: User, request: AuditRequestContext) {
  const sourceRoot = process.env.PUBLIC_GARDEN_SOURCE_DIR
  const configPath = process.env.PUBLIC_GARDEN_MANIFEST
  const outputDirectory = process.env.PUBLIC_GARDEN_OUTPUT_DIR || 'content/public-garden'
  if (!sourceRoot || !configPath) {
    await writeAuditLog(payload, {
      action: 'public-garden.export_failed', actorId: user.id, metadata: { errorCode: 'CONFIGURATION_MISSING' },
      outcome: 'failure', request, resourceType: 'public-garden',
    })
    throw new Error('PUBLIC_GARDEN_SOURCE_DIR 和 PUBLIC_GARDEN_MANIFEST 尚未配置。')
  }
  let config
  try {
    config = await loadPublicGardenConfig(configPath)
  } catch (error) {
    await writeAuditLog(payload, {
      action: error instanceof PublicGardenError ? 'public-garden.export_rejected' : 'public-garden.export_failed',
      actorId: user.id,
      metadata: { errorCode: error instanceof PublicGardenError ? error.code : 'MANIFEST_READ_FAILED' },
      outcome: 'failure', request, resourceType: 'public-garden',
    })
    throw error
  }
  return exportPublicGarden({
    audit: (event) => writeAuditLog(payload, {
      action: event.action,
      actorId: user.id,
      metadata: event.metadata,
      outcome: event.outcome,
      request,
      resourceType: 'public-garden',
    }),
    config,
    outputDirectory,
    sourceRoot,
  })
}
