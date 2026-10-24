import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { getPostBySlug } from '@/lib/content'

type Props = { params: Promise<{ slug: string }> }
const formatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug((await params).slug)
  if (!post) return { title: '文章不存在' }
  return { title: post.seo?.title || post.title, description: post.seo?.description || post.summary }
}
export default async function JournalPostPage({ params }: Props) {
  const post = await getPostBySlug((await params).slug)
  if (!post) notFound()
  return <article className="article-shell shell"><Link className="back-link" href="/journal">← 返回文章</Link><header className="article-header"><p className="eyebrow">{post.contentType.toUpperCase()}</p><h1>{post.title}</h1><p>{post.summary}</p><time dateTime={post.publishedAt ?? post.createdAt}>{formatter.format(new Date(post.publishedAt ?? post.createdAt))}</time></header><RichText data={post.content} />{post.originalUrl ? <p className="source-note">首次发布于旧站：<a href={post.originalUrl} rel="noreferrer" target="_blank">查看原文 ↗</a></p> : null}</article>
}

