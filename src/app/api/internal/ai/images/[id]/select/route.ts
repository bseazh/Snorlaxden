import config from '@payload-config'
import { getPayload } from 'payload'

import { AIImageError, selectCandidate } from '@/modules/ai-images'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache' }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { headers: noStore, status: 401 })
  try {
    const { id } = await params
    const body = await request.json() as { candidateId?: unknown }
    if (!/^\d+$/.test(id) || typeof body.candidateId !== 'string' || !/^[0-9a-f-]{36}$/.test(body.candidateId)) throw new AIImageError('IMAGE_NOT_FOUND', '候选图不存在。', 404)
    return Response.json(await selectCandidate(payload, user, id, body.candidateId, { headers: request.headers }), { headers: noStore })
  } catch (error) {
    if (error instanceof AIImageError) return Response.json({ code: error.code, message: error.message }, { headers: noStore, status: error.status })
    payload.logger.error({ err: error, msg: 'AI image selection failed' })
    return Response.json({ code: 'IMAGE_SELECT_FAILED', message: '选用候选图失败。' }, { headers: noStore, status: 500 })
  }
}
