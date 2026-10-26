import Image from 'next/image'

import type { Media, Post } from '@/payload-types'

const fallbackCovers: Record<Post['contentType'], string> = {
  essay: '/images/article-covers/digital-garden.webp',
  knowledge: '/images/article-covers/medical-ai.webp',
  'project-note': '/images/article-covers/hackathon-practice.webp',
  reflection: '/images/article-covers/default-editorial.webp',
}

function mediaCover(cover: Post['cover'], size: 'card' | 'wide') {
  if (!cover || typeof cover !== 'object') return null
  const media = cover as Media
  return media.sizes?.[size]?.url || media.url || null
}

export function getPostCover(post: Post, size: 'card' | 'wide' = 'card') {
  return mediaCover(post.cover, size) || fallbackCovers[post.contentType] || '/images/article-covers/default-editorial.webp'
}

export function PostCover({ className, post, priority = false, size = 'card' }: {
  className?: string
  post: Post
  priority?: boolean
  size?: 'card' | 'wide'
}) {
  const customCover = post.cover && typeof post.cover === 'object' ? post.cover : null
  return (
    <div className={className}>
      <Image
        alt={customCover?.alt || `${post.title}的文章封面`}
        fill
        priority={priority}
        sizes={size === 'wide' ? '(max-width: 700px) 100vw, 980px' : '(max-width: 700px) 100vw, (max-width: 1000px) 50vw, 33vw'}
        src={getPostCover(post, size)}
        unoptimized={Boolean(customCover)}
      />
      {!customCover ? <span className="cover-fallback-label">主题配图</span> : null}
    </div>
  )
}
