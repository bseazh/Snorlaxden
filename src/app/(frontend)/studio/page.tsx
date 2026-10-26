import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { AIWritingStudio } from '@/components/AIWritingStudio'
import { getDailyUsage, getProviderAvailability, listWorkflowSources } from '@/modules/ai'

export const metadata: Metadata = { title: 'AI 写作工作台', robots: { index: false, follow: false } }

export default async function StudioPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login?redirect=%2Fstudio')

  return (
    <div className="shell studio-shell">
      <header className="studio-heading">
        <div><p className="eyebrow">ADMIN · AI LAB</p><h1>写作工作台</h1></div>
        <nav className="studio-links"><Link className="text-link" href="/manage">创作中心</Link><Link className="text-link" href="/library">材料库</Link><Link className="text-link" href="/studio/images">AI 封面工作台</Link><Link className="text-link" href="/admin">内容后台</Link></nav>
      </header>
      <AIWritingStudio availability={getProviderAvailability()} initialUsage={await getDailyUsage(payload, user.id)} sources={await listWorkflowSources(payload, user.id)} />
    </div>
  )
}
