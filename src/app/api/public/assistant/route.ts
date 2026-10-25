import config from '@payload-config'
import { getPayload } from 'payload'

import { answerPublicQuestion, PublicAssistantError } from '@/modules/public-assistant'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  try {
    const body = await request.json() as { question?: unknown }
    return Response.json(await answerPublicQuestion(payload, body.question, request.headers))
  } catch (error) {
    if (error instanceof PublicAssistantError) {
      return Response.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return Response.json({ code: 'ANSWER_FAILED', message: 'AI 暂时不可用，请选择预设问题。' }, { status: 500 })
  }
}
