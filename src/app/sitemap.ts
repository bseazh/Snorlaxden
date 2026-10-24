import type { MetadataRoute } from 'next'

import { getLatestPosts, getProjects } from '@/modules/content'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const [projects, posts] = await Promise.all([getProjects(), getLatestPosts(100)])
  const staticRoutes = ['', '/about', '/projects', '/journal', '/garden', '/contact']

  return [
    ...staticRoutes.map((route) => ({ url: `${base}${route}`, changeFrequency: 'monthly' as const })),
    ...projects.map((project) => ({ url: `${base}/projects/${project.slug}`, lastModified: project.updatedAt })),
    ...posts.map((post) => ({ url: `${base}/journal/${post.slug}`, lastModified: post.updatedAt })),
  ]
}
