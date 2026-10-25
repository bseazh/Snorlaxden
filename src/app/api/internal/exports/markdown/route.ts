import config from '@payload-config'
import { getPayload } from 'payload'

import { exportPrivateMarkdown, SourceMaterialError } from '@/modules/source-materials'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { headers: noStore, status: 401 })
  try {
    const body = await request.json() as { id?: number | string; type?: 'resource' | 'source-material' }
    if (!body.id || !body.type) throw new SourceMaterialError('VALIDATION_ERROR', '导出类型和记录 ID 为必填项。', 400)
    return Response.json(await exportPrivateMarkdown(payload, user, body.type, body.id, { headers: request.headers }), { headers: noStore })
  } catch (error) {
    if (error instanceof SourceMaterialError) return Response.json({ code: error.code, message: error.message }, { headers: noStore, status: error.status })
    if ((error as { status?: number }).status === 404) return Response.json({ code: 'NOT_FOUND', message: '记录不存在。' }, { headers: noStore, status: 404 })
    payload.logger.error({ err: error, msg: 'Private Markdown export failed' })
    return Response.json({ code: 'EXPORT_FAILED', message: '导出失败，请稍后重试。' }, { headers: noStore, status: 500 })
  }
}
