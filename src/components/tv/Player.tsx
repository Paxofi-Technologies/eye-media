'use client'

/* eslint-disable @next/next/no-img-element -- posters are served by the video provider's image CDN */
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { muxThumbnailUrl, type PlaybackSource } from '@/lib/playback'
import { youTubeEmbedUrl, youTubeThumbnail } from '@/lib/youtube'
import { PlayIcon } from './PlayIcon'

// Loaded only when a viewer presses play, so listing pages never download the player.
const MuxPlayer = dynamic(() => import('@mux/mux-player-react'), {
  ssr: false,
  loading: () => <div className="player-loading">Loading player…</div>,
})

const UNAVAILABLE: Record<'missing' | 'processing' | 'errored', string> = {
  missing: 'Video coming soon',
  processing: 'This video is still being processed. It will be ready in a few minutes.',
  errored: 'This video could not be processed. Upload it again.',
}

/**
 * Click-to-play player for every source. Nothing from the video provider loads until the viewer
 * presses play, which keeps pages light on mobile data and avoids third-party requests up front.
 */
export function Player({
  source,
  title,
  live,
  viewers,
}: {
  source: PlaybackSource
  title: string
  live?: boolean
  viewers?: string | null
}) {
  const [playing, setPlaying] = useState(false)

  if (source.kind === 'none') {
    return (
      <div className="player">
        <div className="dots" />
        <div className="unavailable">{UNAVAILABLE[source.reason]}</div>
      </div>
    )
  }

  if (source.kind === 'upload') {
    return (
      <div className="player">
        {/* Legacy files uploaded before Mux. preload="metadata" fetches only the first bytes until play. */}
        <video src={`/media/${source.id}`} controls playsInline preload="metadata" aria-label={title} />
      </div>
    )
  }

  const poster =
    source.kind === 'youtube'
      ? youTubeThumbnail(source.id)
      : muxThumbnailUrl(source.playbackId, source.token ? { token: source.thumbnailToken } : { width: 1280 })
  const isLive = live ?? (source.kind === 'mux' && source.live)

  return (
    <div className="player">
      {!playing ? (
        <button type="button" className="poster" onClick={() => setPlaying(true)} aria-label={`Play: ${title}`}>
          <img src={poster} alt="" referrerPolicy="no-referrer" />
          <div className="dots" />
          <div className="play">
            <PlayIcon size={64} />
          </div>
        </button>
      ) : source.kind === 'youtube' ? (
        <iframe
          src={youTubeEmbedUrl(source.id, { autoplay: true })}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <MuxPlayer
          playbackId={source.playbackId}
          tokens={source.token ? { playback: source.token, thumbnail: source.thumbnailToken ?? undefined } : undefined}
          streamType={source.live ? 'live' : 'on-demand'}
          autoPlay
          title={title}
          metadata={{ video_title: title }}
          accentColor="#E10600"
          primaryColor="#FFFFFF"
          secondaryColor="#0B0B0B"
          disableTracking={!source.tracking}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      )}
      {!playing && (isLive || viewers) && (
        <div className="overlay-top">
          {isLive ? (
            <span className="badge badge-live">
              <span className="pulse" />
              LIVE
            </span>
          ) : (
            <span />
          )}
          {viewers && <span className="viewers">{viewers}</span>}
        </div>
      )}
    </div>
  )
}
