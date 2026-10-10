import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'
import { getSitemapEntries } from '@/lib/tv'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const videos = await getSitemapEntries()
  return [
    { url: `${base}/tv`, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/tv/live`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/tv/archive`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/tv/submit`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/tv/editorial-policy`, changeFrequency: 'monthly', priority: 0.3 },
    ...videos.map((v) => ({ url: `${base}/tv/${v.slug}`, lastModified: v.updatedAt, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ]
}
