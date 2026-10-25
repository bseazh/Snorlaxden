import type { Payload } from 'payload'

import type { AssistantCitation, AssistantPreset } from './types'

type KnowledgeSource = AssistantCitation & { text: string }

function lexicalText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  if (Array.isArray(value)) return value.map(lexicalText).filter(Boolean).join('\n')
  const record = value as Record<string, unknown>
  const ownText = typeof record.text === 'string' ? record.text : ''
  const childText = lexicalText(record.children)
  const rootText = lexicalText(record.root)
  return [ownText, childText, rootText].filter(Boolean).join('\n')
}

function compactText(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join('\n').replaceAll(/\s+/g, ' ').trim().slice(0, 3_500)
}

export async function getPublicAssistantPresets(payload: Payload): Promise<AssistantPreset[]> {
  const result = await payload.find({
    collection: 'faq-items',
    limit: 8,
    overrideAccess: false,
    sort: 'sortOrder',
  })

  return result.docs.map((item) => ({
    answer: item.answer,
    id: `faq-${item.id}`,
    question: item.question,
    relatedUrl: item.relatedUrl || undefined,
  }))
}

export async function getPublicKnowledge(payload: Payload): Promise<KnowledgeSource[]> {
  const [settings, faqResult, postResult, projectResult] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings', overrideAccess: false }),
    payload.find({ collection: 'faq-items', limit: 20, overrideAccess: false, sort: 'sortOrder' }),
    payload.find({ collection: 'posts', draft: false, limit: 20, overrideAccess: false, sort: '-publishedAt' }),
    payload.find({ collection: 'projects', draft: false, limit: 20, overrideAccess: false, sort: 'sortOrder' }),
  ])

  const sources: KnowledgeSource[] = [{
    id: 'about',
    kind: 'about',
    text: compactText(settings.displayName, settings.roleTitle, settings.tagline, settings.bioShort, lexicalText(settings.bioLong), settings.contactEmail),
    title: `关于${settings.displayName}`,
    url: '/about',
  }]

  for (const item of faqResult.docs) {
    sources.push({ id: `faq-${item.id}`, kind: 'faq', text: compactText(item.question, item.answer), title: item.question, url: item.relatedUrl || '/about' })
  }
  for (const post of postResult.docs) {
    sources.push({ id: `post-${post.id}`, kind: 'post', text: compactText(post.title, post.summary, lexicalText(post.content)), title: post.title, url: `/journal/${post.slug}` })
  }
  for (const project of projectResult.docs) {
    sources.push({ id: `project-${project.id}`, kind: 'project', text: compactText(project.title, project.overview, lexicalText(project.content)), title: project.title, url: `/projects/${project.slug}` })
  }

  return sources.filter((source) => source.text.length > 0)
}

export function knowledgePrompt(sources: KnowledgeSource[]) {
  return sources.map((source) => `[${source.id}] ${source.title}\n${source.text}`).join('\n\n').slice(0, 28_000)
}

export function publicCitations(sources: KnowledgeSource[]) {
  return new Map(sources.map(({ text: _text, ...citation }) => [citation.id, citation]))
}
