import path from 'node:path'

import { readPublicGardenAttachment } from '@/modules/public-garden'
import { detectSourceMaterialMime } from '@/modules/source-materials'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'public, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params
  const output = segments.join('/')
  const result = await readPublicGardenAttachment(output).catch(() => null)
  if (!result) return new Response('Not Found', { headers: noStore, status: 404 })
  const mime = detectSourceMaterialMime(result.bytes)
  if (!mime) return new Response('Not Found', { headers: noStore, status: 404 })
  return new Response(new Uint8Array(result.bytes), {
    headers: {
      ...noStore,
      'Content-Disposition': `inline; filename="${path.posix.basename(output).replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
      'Content-Type': mime,
    },
  })
}
