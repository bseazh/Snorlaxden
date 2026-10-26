import { FileText, Search, Tags } from 'lucide-react'
import Link from 'next/link'

import type { GardenIndex } from '@/modules/public-garden'

export function GardenSearch({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/garden" className="garden-search" role="search">
      <Search aria-hidden="true" size={17} />
      <label className="sr-only" htmlFor="garden-query">搜索公开花园</label>
      <input defaultValue={defaultValue} id="garden-query" name="q" placeholder="搜索标题、正文或标签" type="search" />
      <button type="submit">搜索</button>
    </form>
  )
}

export function GardenDirectory({ garden, currentUrl }: { currentUrl?: string; garden: GardenIndex }) {
  const groups = new Map<string, GardenIndex['notes']>()
  for (const note of garden.notes) {
    const directory = note.output.includes('/') ? note.output.split('/').slice(0, -1).join(' / ') : '根目录'
    groups.set(directory, [...(groups.get(directory) || []), note])
  }
  return (
    <nav aria-label="花园目录" className="garden-directory">
      <p className="garden-panel-title"><FileText aria-hidden="true" size={15} />目录</p>
      {[...groups].map(([directory, notes]) => (
        <div className="garden-directory-group" key={directory}>
          <span>{directory}</span>
          {notes.map((note) => <Link aria-current={currentUrl === note.url ? 'page' : undefined} href={note.url} key={note.output}>{note.title}</Link>)}
        </div>
      ))}
      {garden.notes.length === 0 ? <p className="garden-panel-empty">暂无公开笔记</p> : null}
    </nav>
  )
}

export function GardenTags({ garden, selected }: { garden: GardenIndex; selected?: string }) {
  return (
    <nav aria-label="花园标签" className="garden-tags-panel">
      <p className="garden-panel-title"><Tags aria-hidden="true" size={15} />标签</p>
      <div>
        {garden.tags.map((tag) => (
          <Link aria-current={selected === tag.name ? 'page' : undefined} href={`/garden?tag=${encodeURIComponent(tag.name)}`} key={tag.name}>
            {tag.name}<span>{tag.count}</span>
          </Link>
        ))}
      </div>
      {garden.tags.length === 0 ? <p className="garden-panel-empty">暂无标签</p> : null}
    </nav>
  )
}
