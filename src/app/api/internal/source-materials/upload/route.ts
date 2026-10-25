import config from '@payload-config'
import { getPayload } from 'payload'

import { writeAuditLog } from '@/modules/audit'
import { SOURCE_MATERIAL_MAX_BYTES, SourceMaterialError, uploadSourceMaterial } from '@/modules/source-materials'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
    await writeAuditLog(payload, { action: 'source-material.upload_denied', outcome: 'denied', request: { headers: request.headers }, resourceType: 'source-material' })
    return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { headers: noStore, status: 401 })
  }
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > SOURCE_MATERIAL_MAX_BYTES + 1024 * 1024) {
    await writeAuditLog(payload, {
      action: 'source-material.upload_failed', actorId: user.id, outcome: 'failure',
      metadata: { errorCode: 'FILE_TOO_LARGE' }, request: { headers: request.headers }, resourceType: 'source-material',
    }).catch(() => undefined)
    return Response.json({ code: 'FILE_TOO_LARGE', message: '文件不能超过 10MB。' }, { headers: noStore, status: 413 })
  }
  try {
    const material = await uploadSourceMaterial(payload, user, await request.formData(), { headers: request.headers })
    return Response.json({ id: material.id, sourceId: material.sourceId }, { headers: noStore, status: 201 })
  } catch (error) {
    const known = error instanceof SourceMaterialError
    await writeAuditLog(payload, {
      action: 'source-material.upload_failed', actorId: user.id, outcome: 'failure',
      metadata: { errorCode: known ? error.code : 'UPLOAD_FAILED' }, request: { headers: request.headers }, resourceType: 'source-material',
    }).catch(() => undefined)
    if (known) return Response.json({ code: error.code, message: error.message }, { headers: noStore, status: error.status })
    payload.logger.error({ err: error, msg: 'Source material upload failed' })
    return Response.json({ code: 'UPLOAD_FAILED', message: '上传失败，请稍后重试。' }, { headers: noStore, status: 500 })
  }
}
