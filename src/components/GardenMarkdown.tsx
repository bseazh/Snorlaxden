import Link from 'next/link'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { gardenHeadingId, resolveGardenHref, type GardenNote, type PublicGardenManifest } from '@/modules/public-garden'

function childText(children: React.ReactNode): string {
  return Array.isArray(children) ? children.map(childText).join('') : typeof children === 'string' || typeof children === 'number' ? String(children) : ''
}

export function GardenMarkdown({ manifest, note }: { manifest: PublicGardenManifest; note: GardenNote }) {
  const seen = new Map<string, number>()
  const heading = (level: 2 | 3 | 4) => function Heading({ children }: { children?: React.ReactNode }) {
    const id = gardenHeadingId(childText(children), seen)
    return React.createElement(`h${level}`, { id }, children)
  }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href = '' }) => {
          const resolved = resolveGardenHref(note.output, href, manifest)
          if (/^https?:\/\//i.test(resolved)) return <a href={resolved} rel="noreferrer" target="_blank">{children}</a>
          return <Link href={resolved}>{children}</Link>
        },
        h2: heading(2),
        h3: heading(3),
        h4: heading(4),
        img: ({ alt = '', src = '' }) => {
          const resolved = resolveGardenHref(note.output, String(src), manifest)
          // Markdown assets have author-controlled dimensions and are checksum-gated by the public manifest.
          // eslint-disable-next-line @next/next/no-img-element
          return <img alt={alt} loading="lazy" src={resolved} />
        },
      }}
    >
      {note.body}
    </ReactMarkdown>
  )
}
