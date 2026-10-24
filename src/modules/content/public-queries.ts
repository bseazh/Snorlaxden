import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'

export const getSiteSettings = cache(async () => {
  const payload = await getPayload({ config })
  return payload.findGlobal({ slug: 'site-settings', overrideAccess: false })
})

export const getFeaturedProjects = cache(async (limit = 3) => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'projects',
    depth: 1,
    draft: false,
    limit,
    overrideAccess: false,
    sort: 'sortOrder',
    where: { isFeatured: { equals: true } },
  })
  return result.docs
})

export const getProjects = cache(async () => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'projects',
    depth: 1,
    draft: false,
    limit: 100,
    overrideAccess: false,
    sort: 'sortOrder',
  })
  return result.docs
})

export const getProjectBySlug = cache(async (slug: string) => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'projects',
    depth: 1,
    draft: false,
    limit: 1,
    overrideAccess: false,
    where: { slug: { equals: slug } },
  })
  return result.docs[0] ?? null
})

export const getLatestPosts = cache(async (limit = 6) => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'posts',
    depth: 1,
    draft: false,
    limit,
    overrideAccess: false,
    sort: '-publishedAt',
  })
  return result.docs
})

export const getPostBySlug = cache(async (slug: string) => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'posts',
    depth: 1,
    draft: false,
    limit: 1,
    overrideAccess: false,
    where: { slug: { equals: slug } },
  })
  return result.docs[0] ?? null
})

export const getFAQItems = cache(async () => {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'faq-items',
    limit: 20,
    overrideAccess: false,
    sort: 'sortOrder',
  })
  return result.docs
})
