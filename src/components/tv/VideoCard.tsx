import Link from 'next/link'
import type { VideoCard as VideoCardData } from '@/lib/tv'
import { timeAgo } from '@/lib/format'
import { Thumb } from './Thumb'

export function VerifiedBadge({ long }: { long?: boolean }) {
  return (
    <span className="badge badge-verified" title="Verified by Eye Media editors">
      ✓{long ? ' Verified' : <span className="visually-hidden"> Verified</span>}
    </span>
  )
}

export function VideoCard({
  video,
  index = 0,
  variant = 'default',
  showMeta = true,
  headingLevel = 3,
}: {
  video: VideoCardData
  index?: number
  variant?: 'default' | 'side' | 'related'
  showMeta?: boolean
  headingLevel?: 3 | 4
}) {
  const H = headingLevel === 4 || variant === 'related' ? 'h4' : 'h3'
  const byline = [video.reporterName, timeAgo(video.publishedAt)].filter(Boolean).join(' · ')
  const meta = showMeta && (video.categoryName || video.verified) && (
    <div className="meta-row">
      {video.categoryName && <span className="badge badge-cat">{video.categoryName}</span>}
      {video.verified && <VerifiedBadge />}
    </div>
  )

  if (variant === 'side' || variant === 'related') {
    return (
      <Link className={variant === 'related' ? 'card related-item' : 'card'} href={`/tv/${video.slug}`}>
        <Thumb video={video} alt={index % 2 === 1} showPlay={false} />
        <div>
          {variant === 'side' && meta}
          <H>{video.title}</H>
          <div className="byline">{variant === 'related' ? timeAgo(video.publishedAt) : byline}</div>
        </div>
      </Link>
    )
  }

  return (
    <Link className="card" href={`/tv/${video.slug}`}>
      <Thumb video={video} alt={index % 2 === 1} />
      {meta}
      <H>{video.title}</H>
      <div className="byline">{byline}</div>
    </Link>
  )
}
