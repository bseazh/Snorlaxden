import config from '@payload-config'
import { getPayload } from 'payload'

import { generateArticleDraft } from '@/lib/ai/providers'
import { AIError } from '@/lib/ai/types'
import { validateDraftRequest } from '@/lib/ai/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { status: 401 })

  try {
    const input = validateDraftRequest(await request.json())
    return Response.json(await generateArticleDraft(input))
  } catch (error) {
    if (error instanceof AIError) {
      return Response.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return Response.json({ code: 'GENERATION_FAILED', message: '生成失败，请稍后重试。' }, { status: 500 })
  }
}
