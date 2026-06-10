import type { MetadataRoute } from 'next'
import { tools } from '@/lib/tools-commercial'
import { posts } from '@/lib/posts-commercial'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://netwatchlabs.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/labs`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/cloud`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ]

  const toolRoutes: MetadataRoute.Sitemap = tools.map(t => ({
    url: `${BASE}/labs/${t.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const blogRoutes: MetadataRoute.Sitemap = posts.map(p => ({
    url: `${BASE}/labs/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: 'yearly',
    priority: 0.6,
  }))

  return [...staticRoutes, ...toolRoutes, ...blogRoutes]
}
