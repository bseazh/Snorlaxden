import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'

import type { Post } from '@/payload-types'

export function RichText({ data }: { data: Post['content'] }) {
  const html = convertLexicalToHTML({ data })
  return <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />
}

