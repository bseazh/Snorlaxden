import config from '@payload-config'
import { getPayload } from 'payload'

import { AIError, saveGenerationAsDraft } from '@/modules/ai'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { status: 401 })

  try {
    const body = await request.json() as { generationId?: number | string; slug?: string }
    if (!body.generationId || typeof body.slug !== 'string') {
      throw new AIError('VALIDATION_ERROR', '生成记录和 Slug 均为必填项。', 400)
    }
    return Response.json(await saveGenerationAsDraft(payload, user, { generationId: body.generationId, slug: body.slug }))
  } catch (error) {
    if (error instanceof AIError) {
      return Response.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return Response.json({ code: 'GENERATION_FAILED', message: '保存草稿失败，请稍后重试。' }, { status: 500 })
  }
}
