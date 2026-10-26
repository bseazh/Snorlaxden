import config from '@payload-config'
import { getPayload } from 'payload'

import { AIImageError, generateArticleCover, validateImageGenerationInput } from '@/modules/ai-images'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache' }

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { headers: noStore, status: 401 })
  try {
    return Response.json(await generateArticleCover(payload, user, validateImageGenerationInput(await request.json()), { headers: request.headers }), { headers: noStore })
  } catch (error) {
    if (error instanceof AIImageError) return Response.json({ code: error.code, generationId: error.generationId, message: error.message }, { headers: noStore, status: error.status })
    payload.logger.error({ err: error, msg: 'AI image generation failed' })
    return Response.json({ code: 'IMAGE_GENERATION_FAILED', message: '图片生成失败，请稍后重试。' }, { headers: noStore, status: 500 })
  }
}

