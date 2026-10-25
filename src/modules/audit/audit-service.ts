import { createHash, randomUUID } from 'node:crypto'

import type { Payload, PayloadRequest } from 'payload'

type AuditOutcome = 'success' | 'denied' | 'failure'

export type AuditRequestContext = {
  headers?: Headers
  requestId?: string
}

export type AuditEvent = {
  action: string
  actorId?: number | null
  metadata?: Record<string, boolean | number | string | null | undefined>
  outcome?: AuditOutcome
  request?: AuditRequestContext | Pick<PayloadRequest, 'headers'>
  resourceId?: number | string | null
  resourceType: string
}

export function getAuditRequestDetails(request?: AuditEvent['request']) {
  const headers = request?.headers
  const requestId = request && 'requestId' in request && request.requestId
    ? request.requestId
    : headers?.get('x-request-id') || randomUUID()
  const forwarded = headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
  const address = forwarded || headers?.get('x-real-ip') || 'unavailable'
  const salt = process.env.AUDIT_IP_HASH_SALT || process.env.PAYLOAD_SECRET || 'local-audit-salt'
  const ipHash = createHash('sha256').update(`${salt}:${address}`).digest('hex')
  return { ipHash, requestId }
}

function safeMetadata(metadata?: AuditEvent['metadata']) {
  if (!metadata) return undefined
  const isBlockedKey = (key: string) => {
    const normalized = key.toLowerCase().replaceAll(/[-_]/g, '')
    return ['authorization', 'body', 'content', 'cookie', 'password', 'prompt', 'result', 'secret', 'sourcetext', 'token'].some((blocked) => normalized.includes(blocked)) || normalized.includes('apikey')
  }
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => !isBlockedKey(key) && value !== undefined)
      .map(([key, value]) => [key.slice(0, 80), typeof value === 'string' ? value.slice(0, 240) : value]),
  )
}

export async function writeAuditLog(payload: Payload, event: AuditEvent) {
  const { ipHash, requestId } = getAuditRequestDetails(event.request)
  const payloadRequest = event.request && 'payload' in event.request ? event.request as PayloadRequest : undefined

  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        action: event.action.slice(0, 120),
        actor: event.actorId || undefined,
        ipHash,
        metadata: safeMetadata(event.metadata),
        outcome: event.outcome || 'success',
        requestId,
        resourceId: event.resourceId == null ? undefined : String(event.resourceId),
        resourceType: event.resourceType.slice(0, 80),
      },
      context: { skipAudit: true },
      overrideAccess: true,
      req: payloadRequest,
    })
  } catch (error) {
    payload.logger.error({
      err: error,
      msg: `Audit log write failed for ${event.action}`,
    })
    throw error
  }
}
