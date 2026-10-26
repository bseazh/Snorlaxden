import config from '@payload-config'
import { getPayload } from 'payload'

import { AIImageError, retryImageGeneration } from '@/modules/ai-images'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache' }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { headers: noStore, status: 401 })
  try {
    const { id } = await params
    if (!/^\d+$/.test(id)) throw new AIImageError('NOT_FOUND', '任务不存在。', 404)
    return Response.json(await retryImageGeneration(payload, user, id, { headers: request.headers }), { headers: noStore })
  } catch (error) {
    if (error instanceof AIImageError) return Response.json({ code: error.code, generationId: error.generationId, message: error.message }, { headers: noStore, status: error.status })
    payload.logger.error({ err: error, msg: 'AI image retry failed' })
    return Response.json({ code: 'IMAGE_RETRY_FAILED', message: '重试失败，请稍后再试。' }, { headers: noStore, status: 500 })
  }
}

