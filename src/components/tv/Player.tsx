'use client'

/* eslint-disable @next/next/no-img-element -- poster is served by YouTube's image CDN */
import { useState } from 'react'
import { youTubeEmbedUrl, youTubeThumbnail } from '@/lib/youtube'
import { PlayIcon } from './PlayIcon'

/**
 * Click-to-play YouTube player. Nothing from YouTube loads until the viewer presses play,
 * which keeps pages light on mobile data (NFR-02) and avoids third-party cookies up front.
 */
export function Player({
  youtubeId,
  uploadId = null,
  title,
  live,
  viewers,
}: {
  youtubeId: string | null
  /** A video uploaded to Eye TV: played with the browser's own player from /media/<id>. */
  uploadId?: string | null
  title: string
  live?: boolean
  viewers?: string | null
}) {
  const [playing, setPlaying] = useState(false)

  if (uploadId) {
    return (
      <div className="player">
        {/* preload="metadata" fetches only the first bytes until the viewer presses play. */}
        <video src={`/media/${uploadId}`} controls playsInline preload="metadata" aria-label={title} />
      </div>
    )
  }

  return (
    <div className="player">
      {!youtubeId ? (
        <>
          <div className="dots" />
          <div className="unavailable">Video coming soon</div>
        </>
      ) : playing ? (
        <iframe
          src={youTubeEmbedUrl(youtubeId, { autoplay: true })}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className="poster" onClick={() => setPlaying(true)} aria-label={`Play: ${title}`}>
          <img src={youTubeThumbnail(youtubeId)} alt="" referrerPolicy="no-referrer" />
          <div className="dots" />
          <div className="play">
            <PlayIcon size={64} />
          </div>
        </button>
      )}
      {!playing && (live || viewers) && (
        <div className="overlay-top">
          {live ? (
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
