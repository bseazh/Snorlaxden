import { ArrowLeft, Link2, ListTree } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { GardenMarkdown } from '@/components/GardenMarkdown'
import { GardenDirectory, GardenSearch, GardenTags } from '@/components/GardenNavigation'
import { getPublicGardenNote } from '@/modules/public-garden'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { note } = await getPublicGardenNote(slug)
  if (!note) return { title: '笔记不存在' }
  return { description: note.description, title: note.title }
}

export default async function GardenNotePage({ params }: Props) {
  const { slug } = await params
  const { garden, note } = await getPublicGardenNote(slug)
  if (!note || !garden.manifest) notFound()
  return (
    <div className="garden-workspace garden-reading-workspace">
      <div className="garden-layout shell">
        <aside className="garden-sidebar">
          <GardenSearch />
          <GardenDirectory garden={garden} currentUrl={note.url} />
          <GardenTags garden={garden} />
        </aside>
        <article className="garden-article">
          <Link className="garden-back" href="/garden"><ArrowLeft aria-hidden="true" size={15} />返回花园</Link>
          <header>
            <p className="garden-note-path">{note.output}</p>
            <h1>{note.title}</h1>
            {note.description ? <p>{note.description}</p> : null}
            <div className="garden-note-tags">{note.tags.map((tag) => <Link href={`/garden?tag=${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>)}</div>
          </header>
          <div className="garden-article-grid">
            <div className="garden-markdown"><GardenMarkdown manifest={garden.manifest} note={note} /></div>
            <aside aria-label="本页目录" className="garden-on-this-page">
              <p className="garden-panel-title"><ListTree aria-hidden="true" size={15} />本页目录</p>
              {note.headings.map((heading) => <a className={`depth-${heading.depth}`} href={`#${heading.id}`} key={heading.id}>{heading.title}</a>)}
              {note.headings.length === 0 ? <span>本页没有小标题</span> : null}
            </aside>
          </div>
          <section aria-label="反向链接" className="garden-backlinks">
            <p className="garden-panel-title"><Link2 aria-hidden="true" size={15} />链接到这篇笔记</p>
            {note.backlinks.length ? note.backlinks.map((backlink) => <Link href={backlink.url} key={backlink.url}>{backlink.title}<span>提到了当前笔记</span></Link>) : <p>暂时还没有其他公开笔记链接到这里。</p>}
          </section>
        </article>
      </div>
    </div>
  )
}
