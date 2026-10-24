import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Post } from '@/payload-types'
import type { GeneratedDraft } from '@/modules/ai'

type RichText = NonNullable<Post['content']>

const textNode = (text: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal' as const,
  style: '',
  text,
  type: 'text',
  version: 1,
})

export function generatedDraftToRichText(draft: GeneratedDraft): RichText {
  const children = draft.sections.flatMap((section) => [
    {
      children: [textNode(section.heading)],
      direction: null,
      format: '',
      indent: 0,
      tag: 'h2',
      type: 'heading',
      version: 1,
    },
    ...section.paragraphs.map((paragraph) => ({
      children: [textNode(paragraph)],
      direction: null,
      format: '',
      indent: 0,
      textFormat: 0,
      textStyle: '',
      type: 'paragraph',
      version: 1,
    })),
  ])

  return {
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as RichText
}

const yamlString = (value: string) => JSON.stringify(value)

export function generatedDraftToMarkdown(
  draft: GeneratedDraft,
  metadata: { generationId: number | string; postId: number | string; slug: string },
) {
  const factChecklist = draft.factChecklist.length
    ? draft.factChecklist.map((fact) => `- [ ] ${fact.claim}${fact.question ? `：${fact.question}` : ''} (${fact.status})`).join('\n')
    : '- [ ] 人工通读并核实全部事实'

  return `---
title: ${yamlString(draft.title)}
slug: ${yamlString(metadata.slug)}
summary: ${yamlString(draft.summary)}
status: draft
aiAssisted: true
generationId: ${yamlString(String(metadata.generationId))}
payloadPostId: ${yamlString(String(metadata.postId))}
tags: [${draft.suggestedTags.map(yamlString).join(', ')}]
---

${draft.sections.map((section) => `## ${section.heading}\n\n${section.paragraphs.join('\n\n')}`).join('\n\n')}

## 发布前核实

${factChecklist}
`
}

export async function writeArticleMarkdown(slug: string, markdown: string) {
  const configured = process.env.CONTENT_ARTICLE_DIR || 'content/articles'
  const directory = path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
  await mkdir(directory, { recursive: true })
  const destination = path.join(directory, `${slug}.md`)
  const temporary = path.join(directory, `.${slug}.${process.pid}.tmp`)
  await writeFile(temporary, markdown, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, destination)
  return `content/articles/${slug}.md`
}
