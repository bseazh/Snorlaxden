import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { getProjectBySlug } from '@/lib/content'

type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProjectBySlug((await params).slug)
  if (!project) return { title: '项目不存在' }
  return { title: project.seo?.title || project.title, description: project.seo?.description || project.overview }
}
export default async function ProjectPage({ params }: Props) {
  const project = await getProjectBySlug((await params).slug)
  if (!project) notFound()
  return <article className="article-shell shell"><Link className="back-link" href="/projects">← 返回项目</Link><header className="article-header"><p className="eyebrow">PROJECT CASE</p><h1>{project.title}</h1><p>{project.overview}</p></header><RichText data={project.content} />{project.links?.length ? <div className="project-links">{project.links.map((link) => <a href={link.url} key={link.id ?? link.url} rel="noreferrer" target="_blank">{link.label} ↗</a>)}</div> : null}</article>
}

