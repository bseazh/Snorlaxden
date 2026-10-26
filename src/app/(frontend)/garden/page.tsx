import { ArrowRight, Sprout } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { GardenDirectory, GardenSearch, GardenTags } from '@/components/GardenNavigation'
import { getPublicGarden } from '@/modules/public-garden'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  description: '何海钊持续整理的公开知识笔记，包含人工智能、医疗科研、产品实践与学习方法。',
  title: '知识花园',
}

type Props = { searchParams: Promise<{ q?: string; tag?: string }> }

export default async function GardenPage({ searchParams }: Props) {
  const [{ q = '', tag }, garden] = await Promise.all([searchParams, getPublicGarden()])
  const query = q.trim().toLocaleLowerCase('zh-CN')
  const notes = garden.notes.filter((note) => {
    const matchesTag = !tag || note.tags.includes(tag)
    const haystack = `${note.title}\n${note.description || ''}\n${note.body}\n${note.tags.join(' ')}`.toLocaleLowerCase('zh-CN')
    return matchesTag && (!query || haystack.includes(query))
  })
  return (
    <div className="garden-workspace">
      <header className="garden-hero shell">
        <div>
          <p className="eyebrow">PUBLIC KNOWLEDGE GARDEN</p>
          <h1>知识不是陈列品，<br />而是一张持续生长的网络。</h1>
        </div>
        <div className="garden-hero-meta">
          <span><strong>{garden.notes.length}</strong> 篇公开笔记</span>
          <span><strong>{garden.tags.length}</strong> 个主题标签</span>
          <p>所有内容均来自经过白名单审核的公开副本，不连接私人笔记库。</p>
        </div>
      </header>
      <div className="garden-layout shell">
        <aside className="garden-sidebar">
          <GardenSearch defaultValue={q} />
          <GardenDirectory garden={garden} currentUrl="/garden" />
          <GardenTags garden={garden} selected={tag} />
        </aside>
        <section aria-label="公开笔记" className="garden-note-list">
          <div className="garden-list-heading">
            <div>
              <p className="eyebrow">{query ? 'SEARCH RESULTS' : tag ? 'TAG INDEX' : 'LATEST NOTES'}</p>
              <h2>{query ? `“${q.trim()}”的结果` : tag ? `# ${tag}` : '公开笔记'}</h2>
            </div>
            {(query || tag) ? <Link href="/garden">清除筛选</Link> : null}
          </div>
          {notes.length ? notes.map((note) => (
            <article className="garden-note-row" key={note.output}>
              <div className="garden-note-icon"><Sprout aria-hidden="true" size={19} /></div>
              <div>
                <p className="garden-note-path">{note.output}</p>
                <h3><Link href={note.url}>{note.title}</Link></h3>
                <p>{note.description || note.body.replace(/[#>*_`\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}</p>
                <div className="garden-note-tags">{note.tags.map((value) => <Link href={`/garden?tag=${encodeURIComponent(value)}`} key={value}>#{value}</Link>)}</div>
              </div>
              <Link aria-label={`阅读${note.title}`} className="garden-open-note" href={note.url}><ArrowRight aria-hidden="true" size={19} /></Link>
            </article>
          )) : (
            <div className="garden-empty">
              <Sprout aria-hidden="true" size={30} />
              <h2>{garden.notes.length ? '没有匹配的公开笔记' : '公开花园正在播种'}</h2>
              <p>{garden.notes.length ? '换一个关键词或清除标签筛选。' : '白名单中的第一篇笔记发布后，会从这里开始形成连接。'}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
