import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { Player } from '@/components/tv/Player'
import { mediaSource } from '@/lib/media'
import { thumbnailFor } from '@/components/tv/Thumb'
import { VerifiedBadge, VideoCard } from '@/components/tv/VideoCard'
import { formatCount, formatDate, formatDuration, initials } from '@/lib/format'
import { siteUrl as getSiteUrl } from '@/lib/site'
import { SLUG_PATTERN } from '@/lib/slug'
import { getPublishedVideo, getRelated, recordView } from '@/lib/tv'

const load = cache(async (slug: string) => (SLUG_PATTERN.test(slug) ? getPublishedVideo(slug) : null))

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const video = await load(slug)
  if (!video) return { title: 'Report not found' }
  const image = thumbnailFor(video)
  return {
    title: video.title,
    description: video.summary ?? undefined,
    alternates: { canonical: `/tv/${video.slug}` },
    openGraph: {
      type: 'video.other',
      title: video.title,
      description: video.summary ?? undefined,
      url: `/tv/${video.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const video = await load(slug)
  if (!video) notFound()

  const [related] = await Promise.all([getRelated(video, 7), recordView(video.id)])
  const sidebar = related.slice(0, 3)
  const more = related.slice(3)
  const siteUrl = getSiteUrl()
  const shareUrl = `${siteUrl}/tv/${video.slug}`
  const image = thumbnailFor(video)

  // schema.org VideoObject for search engines (SRS FR-10).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.summary ?? video.title,
    thumbnailUrl: image ? [image] : undefined,
    uploadDate: video.publishedAt?.toISOString(),
    duration: video.durationSeconds ? `PT${video.durationSeconds}S` : undefined,
    embedUrl:
      video.provider === 'youtube' && video.providerRef ? `https://www.youtube-nocookie.com/embed/${video.providerRef}` : undefined,
    contentUrl: video.provider === 'upload' && video.providerRef ? `${siteUrl}/media/${video.providerRef}` : undefined,
    publisher: { '@type': 'Organization', name: 'Eye Media Group' },
  }

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output is escaped for "<" so content can't break out of the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="wrap video-layout">
        <article>
          <Player {...mediaSource(video.provider, video.providerRef)} title={video.title} />
          <div className="meta-row" style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {video.categoryName && (
              <Link className="badge badge-cat" href={`/tv/archive?category=${video.categorySlug}&range=all`}>
                {video.categoryName}
              </Link>
            )}
            {video.verified && <span className="badge badge-verified">✓ Verified by Eye Media</span>}
          </div>
          <h1 className="vd-title">{video.title}</h1>
          <div className="vd-stats">
            <span>{formatCount(video.viewCount + 1)} views</span>
            {video.publishedAt && <time dateTime={video.publishedAt.toISOString()}>{formatDate(video.publishedAt)}</time>}
            {formatDuration(video.durationSeconds) && <span>{formatDuration(video.durationSeconds)}</span>}
            {video.location && <span>{video.location}</span>}
          </div>
          {video.reporterName && (
            <div className="reporter-row">
              <div className="avatar" aria-hidden="true">
                {initials(video.reporterName)}
              </div>
              <div>
                <div className="reporter-name">
                  {video.reporterName}
                  {video.reporterTitle && <VerifiedBadge long />}
                </div>
                <div className="reporter-role">{video.reporterTitle ?? 'Contributor'}</div>
              </div>
            </div>
          )}
          {video.description && <p className="vd-desc">{video.description}</p>}
          {video.verified && (
            <div className="verify-note">
              ✓ This report was reviewed and verified under Eye Media&apos;s Open Access + Professional Gatekeeping
              editorial model before publication. <Link href="/tv/editorial-policy">How we verify</Link>
            </div>
          )}
          {video.tags.length > 0 && (
            <div className="tag-list" aria-label="Tags">
              {video.tags.map((t) => (
                <Link key={t} className="badge badge-cat" href={`/tv/archive?q=${encodeURIComponent(t)}&range=all`}>
                  #{t}
                </Link>
              ))}
            </div>
          )}
          <div className="share-row" aria-label="Share">
            <a
              className="btn btn-ghost btn-sm"
              href={`https://wa.me/?text=${encodeURIComponent(`${video.title} ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on WhatsApp
            </a>
            <a
              className="btn btn-ghost btn-sm"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(video.title)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on X
            </a>
            <a
              className="btn btn-ghost btn-sm"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on Facebook
            </a>
          </div>
        </article>
        {sidebar.length > 0 && (
          <aside>
            <h2 className="related-head">Related reports</h2>
            {sidebar.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} variant="related" />
            ))}
          </aside>
        )}
      </div>

      {more.length > 0 && (
        <section className="wrap section-pad" aria-labelledby="more-h">
          <div className="section-head">
            <h2 id="more-h">More like this</h2>
          </div>
          <div className="grid-4">
            {more.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} showMeta={false} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
