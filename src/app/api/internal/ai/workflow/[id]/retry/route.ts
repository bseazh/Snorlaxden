import config from '@payload-config'
import { getPayload } from 'payload'

import { AIError, retrySourceWorkflow } from '@/modules/ai'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { status: 401 })
  try {
    const { id } = await params
    if (!/^\d+$/.test(id)) throw new AIError('VALIDATION_ERROR', '任务 ID 格式不正确。', 400)
    return Response.json(await retrySourceWorkflow(payload, user, id, { headers: request.headers }))
  } catch (error) {
    if (error instanceof AIError) return Response.json({ code: error.code, generationId: error.generationId, message: error.message, stage: error.stage }, { status: error.status })
    return Response.json({ code: 'GENERATION_FAILED', message: '重试失败，请稍后再试。' }, { status: 500 })
  }
}
