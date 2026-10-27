import type { CollectionBeforeChangeHook } from 'payload'
import { ValidationError } from 'payload'

import type { Media, Post } from '../../payload-types'

function relationID(value: unknown): number | string | undefined {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export const enforcePostPublishQuality: CollectionBeforeChangeHook<Post> = async ({ data, originalDoc, req }) => {
  const next = { ...originalDoc, ...data, seo: { ...originalDoc?.seo, ...data.seo } }
  if (next._status !== 'published') return data

  const errors: Array<{ message: string; path: string }> = []
  const coverID = relationID(next.cover)

  if (!coverID) errors.push({ message: '发布文章前必须选择正式封面。', path: 'cover' })
  if (!hasText(next.seo?.title)) errors.push({ message: '发布文章前必须填写 SEO 标题。', path: 'seo.title' })
  if (!hasText(next.seo?.description)) errors.push({ message: '发布文章前必须填写 SEO 描述。', path: 'seo.description' })

  if (coverID) {
    let cover: Media | undefined
    try {
      cover = await req.payload.findByID({ collection: 'media', depth: 0, id: coverID, overrideAccess: true })
    } catch {
      errors.push({ message: '所选封面不存在或无法读取。', path: 'cover' })
    }

    if (cover) {
      if (!hasText(cover.alt)) errors.push({ message: '封面必须填写替代文本。', path: 'cover' })
      if (!hasText(cover.licenseNote)) errors.push({ message: '封面必须填写授权说明。', path: 'cover' })
      if (cover.visibility !== 'public') errors.push({ message: '发布文章只能使用公开可见的封面。', path: 'cover' })

      if (cover.aiGenerated || cover.purpose === 'ai_image') {
        if (!relationID(cover.sourceImageGeneration)) errors.push({ message: 'AI 封面缺少生成记录。', path: 'cover' })
        if (!hasText(cover.aiProvider)) errors.push({ message: 'AI 封面缺少 Provider 信息。', path: 'cover' })
        if (!hasText(cover.aiModel)) errors.push({ message: 'AI 封面缺少模型信息。', path: 'cover' })
        if (!hasText(cover.aiPromptVersion)) errors.push({ message: 'AI 封面缺少 Prompt 版本。', path: 'cover' })
      }
    }
  }

  if (errors.length) throw new ValidationError({ collection: 'posts', errors, id: originalDoc?.id, req })
  return data
}
