import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import { exportConfiguredPublicGarden, PublicGardenError } from '@/modules/public-garden'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return Response.json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' }, { headers: noStore, status: 401 })
  try {
    const manifest = await exportConfiguredPublicGarden(payload, user, { headers: request.headers })
    revalidatePath('/garden', 'layout')
    return Response.json({ manifest }, { headers: noStore })
  } catch (error) {
    if (error instanceof PublicGardenError) return Response.json({ code: error.code, message: error.message }, { headers: noStore, status: error.status })
    payload.logger.error({ err: error, msg: 'Public garden export failed' })
    return Response.json({ code: 'EXPORT_FAILED', message: '公开花园导出失败，请检查服务端配置和审计日志。' }, { headers: noStore, status: 500 })
  }
}
