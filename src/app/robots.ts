import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL ?? 'http://localhost:3000'
  // Staging (and anything not explicitly opted in) is closed to crawlers.
  if (process.env.SITE_INDEXING !== 'true') return { rules: [{ userAgent: '*', disallow: '/' }] }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: `${base}/sitemap.xml`,
  }
}
