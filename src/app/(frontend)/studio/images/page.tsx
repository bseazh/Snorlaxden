import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { AIImageStudio } from '@/components/AIImageStudio'
import { getImageDailyUsage, getImageProviderAvailability, listImageStudioSources } from '@/modules/ai-images'

export const metadata: Metadata = { title: 'AI 封面工作台', robots: { index: false, follow: false } }

export default async function ImageStudioPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login?redirect=%2Fstudio%2Fimages')
  return <div className="shell studio-shell">
    <header className="studio-heading"><div><p className="eyebrow">ADMIN · IMAGE LAB</p><h1>AI 封面工作台</h1><p>合法人物参考 → 私有候选图 → 人工选用 → 文章草稿。</p></div><nav className="studio-links"><Link className="text-link" href="/studio">写作工作台</Link><Link className="text-link" href="/admin">内容后台</Link></nav></header>
    <AIImageStudio availability={getImageProviderAvailability()} initialUsage={await getImageDailyUsage(payload, user.id)} sources={await listImageStudioSources(payload, user.id)} />
  </div>
}

