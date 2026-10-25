import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createLocalReq, getPayload, type Where } from 'payload'

import config from '@payload-config'
import { ResourceQuickAdd } from '@/components/ResourceQuickAdd'
import { ResourceTimeline } from '@/components/ResourceTimeline'
import { RESOURCE_TYPES, RESOURCE_VISIBILITIES, type ResourceType, type ResourceVisibility } from '@/modules/resources'

export const metadata: Metadata = { title: '私人资源库', robots: { index: false, follow: false } }

type Props = { searchParams: Promise<{ tag?: string; type?: string; visibility?: string }> }

export default async function LibraryPage({ searchParams }: Props) {
  const payload = await getPayload({ config })
  const requestHeaders = await headers()
  const { user } = await payload.auth({ headers: requestHeaders })
  if (!user) redirect('/admin/login?redirect=%2Flibrary')
  const req = await createLocalReq({ req: { headers: requestHeaders }, user }, payload)

  const filters = await searchParams
  const type = RESOURCE_TYPES.includes(filters.type as ResourceType) ? filters.type as ResourceType : undefined
  const visibility = RESOURCE_VISIBILITIES.includes(filters.visibility as ResourceVisibility) ? filters.visibility as ResourceVisibility : undefined
  const clauses: Where[] = []
  if (type) clauses.push({ resourceType: { equals: type } })
  if (visibility) clauses.push({ visibility: { equals: visibility } })
  if (filters.tag && /^\d+$/.test(filters.tag)) clauses.push({ tags: { contains: Number(filters.tag) } })

  const [result, tags] = await Promise.all([
    payload.find({ collection: 'resources', depth: 1, limit: 100, overrideAccess: false, req, sort: '-capturedAt', where: clauses.length ? { and: clauses } : undefined }),
    payload.find({ collection: 'tags', limit: 100, overrideAccess: false, sort: 'name' }),
  ])

  return <div className="library-page">
    <div className="shell library-shell">
      <header className="library-heading"><div><p className="eyebrow">PRIVATE LIBRARY</p><h1>第二知识仓库</h1><p>收藏、判断、关联。资源默认私有，公开候选也不会自动出现在公开站。</p></div><div className="library-heading-links"><Link href="/admin/collections/resources">管理全部字段</Link><Link href="/admin">返回后台</Link></div></header>
      <div className="library-layout">
        <aside className="library-sidebar"><ResourceQuickAdd /><form className="resource-filters"><strong>筛选时间线</strong><label>类型<select defaultValue={type || ''} name="type"><option value="">全部类型</option><option value="note">短记</option><option value="link">网页</option><option value="video">视频</option><option value="book">图书</option><option value="image">图片</option><option value="activity">活动</option></select></label><label>可见性<select defaultValue={visibility || ''} name="visibility"><option value="">全部状态</option><option value="private">私有</option><option value="review">待审核</option><option value="public">公开候选</option></select></label><label>标签<select defaultValue={filters.tag || ''} name="tag"><option value="">全部标签</option>{tags.docs.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label><div><button type="submit">应用筛选</button><Link href="/library">清除</Link></div></form></aside>
        <main className="library-feed"><div className="library-feed-head"><strong>最近记录</strong><span>{result.totalDocs} 条资源 · 按收藏时间倒序</span></div><ResourceTimeline resources={result.docs} /></main>
      </div>
    </div>
  </div>
}
