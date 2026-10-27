import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import matter from 'gray-matter'
import { getPayload } from 'payload'

import type { Post } from '../payload-types'
import { writeAuditLog } from '../modules/audit'
import config from '../payload.config'

type ArticleMetadata = {
  contentType: Post['contentType']
  cover: string
  coverAlt: string
  publishedAt: string
  slug: string
  summary: string
  tags: string[]
  title: string
}

type CoverMetadata = {
  file: string
  model: string
  prompt: string
  promptVersion: string
  provider: 'qmg2s'
}

const articleDirectory = path.resolve('content/articles/curated')
const coverDirectory = path.resolve('public/images/article-covers/positioning')
const coverManifest = JSON.parse(await readFile(path.join(articleDirectory, 'covers.json'), 'utf8')) as Record<string, CoverMetadata>

function richText(markdown: string): Post['content'] {
  const children = markdown
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const heading = value.startsWith('## ')
      const text = heading ? value.slice(3).trim() : value.replaceAll('\n', ' ').trim()
      return {
        children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }],
        direction: null,
        format: '',
        indent: 0,
        type: heading ? 'heading' : 'paragraph',
        version: 1,
        ...(heading ? { tag: 'h2' } : { textFormat: 0, textStyle: '' }),
      }
    })

  return { root: { children, direction: null, format: '', indent: 0, type: 'root', version: 1 } } as Post['content']
}

const payload = await getPayload({ config: await config })
const administrators = await payload.find({ collection: 'users', limit: 1, overrideAccess: true, where: { role: { equals: 'admin' } } })
const administrator = administrators.docs[0]
if (!administrator) throw new Error('No administrator exists. Create an admin before publishing curated articles.')

const filenames = (await readdir(articleDirectory)).filter((name) => name.endsWith('.md')).sort()

for (const filename of filenames) {
  const source = await readFile(path.join(articleDirectory, filename), 'utf8')
  const parsed = matter(source)
  const metadata = parsed.data as ArticleMetadata
  const cover = coverManifest[metadata.slug]
  if (!cover) throw new Error(`Missing cover manifest entry for ${metadata.slug}`)

  const existing = await payload.find({ collection: 'posts', limit: 1, overrideAccess: true, where: { slug: { equals: metadata.slug } } })
  if (existing.totalDocs) {
    payload.logger.info(`Curated article ${metadata.slug} already exists; skipped.`)
    continue
  }

  const tagIDs: number[] = []
  for (const name of metadata.tags) {
    const tagSlugs: Record<string, string> = {
      '医疗科研 AI': 'medical-research-ai', '文献解析': 'literature-review', '培训方法': 'training-method',
      '隐私安全': 'privacy-security', '黑客松': 'hackathon', '组织实践': 'community-operations', '项目案例': 'case-study',
    }
    const slug = tagSlugs[name] || name.toLowerCase().replaceAll(/\s+/g, '-')
    const found = await payload.find({ collection: 'tags', limit: 1, overrideAccess: true, where: { slug: { equals: slug } } })
    const tag = found.docs[0] || await payload.create({ collection: 'tags', data: { name, slug }, overrideAccess: true })
    tagIDs.push(tag.id)
  }

  let generationID: number | undefined
  let mediaID: number | undefined
  let postID: number | undefined
  let sourceMaterialID: number | undefined
  try {
    const post = await payload.create({
      collection: 'posts', draft: true, overrideAccess: true,
      data: {
        author: administrator.id, content: richText(parsed.content), contentType: metadata.contentType,
        reviewState: 'approved', slug: metadata.slug, summary: metadata.summary, tags: tagIDs, title: metadata.title,
      },
    })
    postID = post.id

    const sourceMaterial = await payload.create({
      collection: 'source-materials', overrideAccess: true,
      data: {
        author: administrator.id, authorizationBasis: 'owned', authorizationNote: '站长委托生成并拥有用于本站发布的内容资产。',
        capturedAt: new Date().toISOString(), materialType: 'typed_note', personalNotes: cover.prompt,
        posts: [post.id], privacy: 'private', sourceDescription: `${cover.provider} / ${cover.model} 文章封面生成说明。`,
        sourceId: `curated-cover-${metadata.slug}-v1`, title: `${metadata.title}：封面生成来源记录`,
      },
    })
    sourceMaterialID = sourceMaterial.id

    const generation = await payload.create({
      collection: 'ai-image-generations', overrideAccess: true,
      data: {
        creator: administrator.id, generationCallCount: 1, idempotencyKey: `curated-cover-${metadata.slug}-v1`,
        model: cover.model, post: post.id, prompt: cover.prompt, promptVersion: cover.promptVersion, provider: cover.provider,
        referenceMaterial: sourceMaterial.id, request: { aspectRatio: '3:2', quality: 'low', source: 'BigApple image batch' },
        requestedCount: 1, retryCount: 0, status: 'succeeded',
      },
    })
    generationID = generation.id

    const coverPath = path.join(coverDirectory, cover.file)
    const coverBytes = await readFile(coverPath)
    const media = await payload.create({
      collection: 'media', filePath: coverPath, overrideAccess: true,
      data: {
        aiGenerated: true, aiModel: cover.model, aiPromptVersion: cover.promptVersion, aiProvider: cover.provider,
        alt: metadata.coverAlt, licenseNote: '站长委托 AI 生成并人工选用，仅用于 Snorlaxden 内容展示。', purpose: 'ai_image',
        sha256: createHash('sha256').update(coverBytes).digest('hex'), sourceImageGeneration: generation.id, visibility: 'public',
      },
    })
    mediaID = media.id

    await payload.update({
      collection: 'posts', draft: false, id: post.id, overrideAccess: true,
      data: {
        _status: 'published', aiDisclosure: true, cover: media.id, publishedAt: metadata.publishedAt,
        seo: { description: metadata.summary, image: media.id, title: `${metadata.title}｜何海钊` },
      },
    })
    await payload.update({
      collection: 'ai-image-generations', id: generation.id, overrideAccess: true,
      data: { selectedCandidateId: `curated-${metadata.slug}`, selectedMedia: media.id, status: 'selected' },
    })
    await writeAuditLog(payload, {
      action: 'content.curated_published', actorId: administrator.id,
      metadata: { provider: cover.provider, slug: metadata.slug }, resourceId: post.id, resourceType: 'post',
    })
    payload.logger.info(`Published curated article ${metadata.slug}.`)
  } catch (error) {
    if (mediaID) await payload.delete({ collection: 'media', id: mediaID, overrideAccess: true }).catch(() => undefined)
    if (generationID) await payload.delete({ collection: 'ai-image-generations', id: generationID, overrideAccess: true }).catch(() => undefined)
    if (sourceMaterialID) await payload.delete({ collection: 'source-materials', id: sourceMaterialID, overrideAccess: true }).catch(() => undefined)
    if (postID) await payload.delete({ collection: 'posts', id: postID, overrideAccess: true }).catch(() => undefined)
    throw error
  }
}

await payload.destroy()
