import Link from 'next/link'

import type { Post } from '@/payload-types'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

export function PostList({ posts }: { posts: Post[] }) {
  return <div className="post-list">{posts.map((post) => (
    <article className="post-row" key={post.id}>
      <time dateTime={post.publishedAt ?? post.createdAt}>{dateFormatter.format(new Date(post.publishedAt ?? post.createdAt))}</time>
      <div><h3><Link href={`/journal/${post.slug}`}>{post.title}</Link></h3><p>{post.summary}</p></div>
      <Link className="text-link" href={`/journal/${post.slug}`} aria-label={`阅读 ${post.title}`}>阅读 →</Link>
    </article>
  ))}</div>
}
