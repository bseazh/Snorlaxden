import config from '@payload-config'
import { getPayload } from 'payload'

import { AIImageError, deleteCandidate, readCandidate } from '@/modules/ai-images'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' }

export async function GET(request: Request, { params }: { params: Promise<{ candidateId: string; id: string }> }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { headers: noStore, status: 401 })
  try {
    const { candidateId, id } = await params
    if (!/^\d+$/.test(id) || !/^[0-9a-f-]{36}$/.test(candidateId)) throw new AIImageError('IMAGE_NOT_FOUND', '候选图不存在。', 404)
    const { bytes, candidate } = await readCandidate(payload, user, id, candidateId, { headers: request.headers })
    return new Response(bytes, { headers: { ...noStore, 'Content-Disposition': 'inline', 'Content-Length': String(bytes.byteLength), 'Content-Type': candidate.mimeType } })
  } catch (error) {
    if (error instanceof AIImageError) return Response.json({ code: error.code, message: error.message }, { headers: noStore, status: error.status })
    payload.logger.error({ err: error, msg: 'AI image preview failed' })
    return Response.json({ code: 'IMAGE_READ_FAILED', message: '读取候选图失败。' }, { headers: noStore, status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ candidateId: string; id: string }> }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { headers: noStore, status: 401 })
  try {
    const { candidateId, id } = await params
    if (!/^\d+$/.test(id) || !/^[0-9a-f-]{36}$/.test(candidateId)) throw new AIImageError('IMAGE_NOT_FOUND', '候选图不存在。', 404)
    return Response.json(await deleteCandidate(payload, user, id, candidateId, { headers: request.headers }), { headers: noStore })
  } catch (error) {
    if (error instanceof AIImageError) return Response.json({ code: error.code, message: error.message }, { headers: noStore, status: error.status })
    payload.logger.error({ err: error, msg: 'AI image delete failed' })
    return Response.json({ code: 'IMAGE_DELETE_FAILED', message: '删除候选图失败。' }, { headers: noStore, status: 500 })
  }
}

