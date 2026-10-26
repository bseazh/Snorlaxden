import config from '@payload-config'
import { getPayload } from 'payload'

import { AIError, createSourceWorkflow, validateWorkflowRequest } from '@/modules/ai'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { status: 401 })
  try {
    return Response.json(await createSourceWorkflow(payload, user, validateWorkflowRequest(await request.json()), { headers: request.headers }))
  } catch (error) {
    if (error instanceof AIError) return Response.json({ code: error.code, generationId: error.generationId, message: error.message, stage: error.stage }, { status: error.status })
    return Response.json({ code: 'GENERATION_FAILED', message: '生成失败，请稍后重试。' }, { status: 500 })
  }
}
