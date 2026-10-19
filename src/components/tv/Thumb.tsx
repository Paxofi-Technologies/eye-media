/* eslint-disable @next/next/no-img-element -- thumbnails are served directly by YouTube's image CDN */
import { formatDuration } from '@/lib/format'
import { isMuxId, muxThumbnailUrl, youTubeIdOf } from '@/lib/playback'
import { youTubeThumbnail } from '@/lib/youtube'
import { PlayIcon } from './PlayIcon'

/** Thumbnail for public surfaces: only ever uses the public Mux playback id. */
export function thumbnailFor(v: {
  thumbnailUrl?: string | null
  provider?: string | null
  providerRef?: string | null
  muxPublicPlaybackId?: string | null
}): string | null {
  if (v.thumbnailUrl && v.thumbnailUrl.startsWith('https://')) return v.thumbnailUrl
  if (isMuxId(v.muxPublicPlaybackId)) return muxThumbnailUrl(v.muxPublicPlaybackId, { width: 640 })
  const yt = youTubeIdOf(v.provider, v.providerRef)
  return yt ? youTubeThumbnail(yt) : null
}

export function Thumb({
  video,
  alt = false,
  chip,
  showPlay = true,
}: {
  video: {
    thumbnailUrl?: string | null
    provider?: string | null
    providerRef?: string | null
    muxPublicPlaybackId?: string | null
    durationSeconds?: number | null
  }
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
