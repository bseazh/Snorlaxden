import config from '@payload-config'
import { getPayload } from 'payload'

import { writeAuditLog } from '@/modules/audit'
import { getPrivateStorage, privateDownloadHeaders, SourceMaterialError } from '@/modules/source-materials'

export const dynamic = 'force-dynamic'

const deniedHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache', 'Vary': 'Cookie, Authorization' }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
    await writeAuditLog(payload, { action: 'source-material.download_denied', outcome: 'denied', request: { headers: request.headers }, resourceType: 'source-material' })
    return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { headers: deniedHeaders, status: 401 })
  }
  const { id } = await context.params
  if (!/^\d+$/.test(id)) return Response.json({ code: 'NOT_FOUND', message: '附件不存在。' }, { headers: deniedHeaders, status: 404 })
  try {
    const material = await payload.findByID({ collection: 'source-materials', id: Number(id), overrideAccess: true })
    if (!material.storageKey) return Response.json({ code: 'NOT_FOUND', message: '附件不存在。' }, { headers: deniedHeaders, status: 404 })
    const bytes = await getPrivateStorage(material.storageDriver).read(material.storageKey)
    await writeAuditLog(payload, {
      action: 'source-material.downloaded', actorId: user.id,
      metadata: { byteSize: material.byteSize || bytes.byteLength, mimeType: material.mimeType || undefined },
      request: { headers: request.headers }, resourceId: material.id, resourceType: 'source-material',
    })
    return new Response(bytes, { headers: privateDownloadHeaders(material.mimeType, material.originalFileName) })
  } catch (error) {
    if ((error as { status?: number }).status === 404) return Response.json({ code: 'NOT_FOUND', message: '附件不存在。' }, { headers: deniedHeaders, status: 404 })
    const known = error instanceof SourceMaterialError
    await writeAuditLog(payload, {
      action: 'source-material.download_failed', actorId: user.id, outcome: 'failure',
      metadata: { errorCode: known ? error.code : 'DOWNLOAD_FAILED' }, request: { headers: request.headers }, resourceId: id, resourceType: 'source-material',
    }).catch(() => undefined)
    payload.logger.error({ err: error, msg: 'Private source material download failed' })
    return Response.json({ code: 'DOWNLOAD_FAILED', message: '下载失败，请稍后重试。' }, { headers: deniedHeaders, status: 500 })
  }
}
