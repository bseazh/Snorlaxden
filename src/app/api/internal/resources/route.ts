import config from '@payload-config'
import { getPayload } from 'payload'

import { createResource, ResourceError, validateCreateResourceInput } from '@/modules/resources'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { status: 401 })

  try {
    const input = validateCreateResourceInput(await request.json())
    const resource = await createResource(payload, user, input, { headers: request.headers })
    return Response.json({ id: resource.id, sourceId: resource.sourceId }, { status: 201 })
  } catch (error) {
    if (error instanceof ResourceError) {
      return Response.json({ code: error.code, message: error.message }, { status: error.status })
    }
    payload.logger.error({ err: error, msg: 'Resource creation failed' })
    return Response.json({ code: 'CREATE_FAILED', message: '保存失败，请稍后重试。' }, { status: 500 })
  }
}

