/* eslint-disable @next/next/no-img-element -- thumbnails are served directly by YouTube's image CDN */
import { formatDuration } from '@/lib/format'
import { isYouTubeId, youTubeThumbnail } from '@/lib/youtube'
import { PlayIcon } from './PlayIcon'

export function thumbnailFor(v: { thumbnailUrl?: string | null; providerRef?: string | null }): string | null {
  if (v.thumbnailUrl && v.thumbnailUrl.startsWith('https://')) return v.thumbnailUrl
  if (v.providerRef && isYouTubeId(v.providerRef)) return youTubeThumbnail(v.providerRef)
  return null
}

export function Thumb({
  video,
  alt = false,
  chip,
  showPlay = true,
}: {
  video: { thumbnailUrl?: string | null; providerRef?: string | null; durationSeconds?: number | null }
  alt?: boolean
  chip?: string | null
  showPlay?: boolean
}) {
  const src = thumbnailFor(video)
  const label = chip ?? formatDuration(video.durationSeconds)
  return (
    <div className={alt ? 'thumb alt' : 'thumb'}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <div className="dots" />}
      {label && <span className="duration-chip">{label}</span>}
      {showPlay && (
        <div className="play">
          <PlayIcon size={52} />
        </div>
      )}
    </div>
  )
}
