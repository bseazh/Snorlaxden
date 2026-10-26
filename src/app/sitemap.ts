import type { MetadataRoute } from 'next'

import { getLatestPosts, getProjects } from '@/modules/content'
import { getPublicGarden } from '@/modules/public-garden'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const [projects, posts, garden] = await Promise.all([getProjects(), getLatestPosts(100), getPublicGarden()])
  const staticRoutes = ['', '/about', '/projects', '/journal', '/garden', '/contact']

  return [
    ...staticRoutes.map((route) => ({ url: `${base}${route}`, changeFrequency: 'monthly' as const })),
    ...projects.map((project) => ({ url: `${base}/projects/${project.slug}`, lastModified: project.updatedAt })),
    ...posts.map((post) => ({ url: `${base}/journal/${post.slug}`, lastModified: post.updatedAt })),
    ...garden.notes.filter((note) => note.url !== '/garden').map((note) => ({
      url: `${base}${note.url}`,
      ...(note.updatedAt ? { lastModified: note.updatedAt } : {}),
    })),
  ]
}
