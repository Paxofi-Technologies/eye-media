import 'server-only'
import type { MediaStatus } from '@/db/schema'
import { isMuxId, muxThumbnailUrl, type PlaybackSource, youTubeIdOf } from './playback'
import { muxStatus } from './mux'
import { signPlaybackToken } from './mux-security'

const VIDEO_TOKEN_TTL = 12 * 60 * 60
const LIVE_TOKEN_TTL = 24 * 60 * 60
const THUMB_TOKEN_TTL = 12 * 60 * 60

const tracking = () => process.env.MUX_DATA_ENABLED?.trim() === 'true'

type MuxFields = {
  provider: string | null
  providerRef: string | null
  muxPublicPlaybackId?: string | null
  muxPrivatePlaybackId?: string | null
}

/** Signed playback only works when the signing key is configured. */
function signedSource(privateId: string, live: boolean): PlaybackSource {
  if (!muxStatus().signing) return { kind: 'none', reason: 'missing' }
  return {
    kind: 'mux',
    playbackId: privateId,
    token: signPlaybackToken(privateId, 'v', live ? LIVE_TOKEN_TTL : VIDEO_TOKEN_TTL),
    thumbnailToken: signPlaybackToken(privateId, 't', THUMB_TOKEN_TTL),
    live,
    tracking: tracking(),
  }
}

/**
 * Playback for a video. `preview` is for signed-in staff only: it falls back to the private playback id
 * (with a signed token) when the video is not published. Public pages must never pass preview.
 */
export function playbackForVideo(v: MuxFields & { mediaStatus?: MediaStatus | null }, opts: { preview: boolean }): PlaybackSource {
  if (v.provider === 'mux') {
    if (v.mediaStatus === 'processing') return { kind: 'none', reason: 'processing' }
    if (v.mediaStatus === 'errored') return { kind: 'none', reason: 'errored' }
    if (isMuxId(v.muxPublicPlaybackId)) {
      return { kind: 'mux', playbackId: v.muxPublicPlaybackId, token: null, thumbnailToken: null, live: false, tracking: tracking() }
    }
    if (opts.preview && isMuxId(v.muxPrivatePlaybackId)) return signedSource(v.muxPrivatePlaybackId, false)
    return { kind: 'none', reason: 'missing' }
  }
  if (v.provider === 'upload' && v.providerRef) return { kind: 'upload', id: v.providerRef }
  const yt = youTubeIdOf(v.provider, v.providerRef)
  return yt ? { kind: 'youtube', id: yt } : { kind: 'none', reason: 'missing' }
}

/**
 * Playback for a live event. The public id is only honoured while the event is on air (it is removed
 * when the event ends, but this keeps pages correct even if that cleanup is pending).
 * Staff preview can always watch through the private id.
 */
export function playbackForEvent(e: MuxFields & { status: string }, opts: { preview: boolean }): PlaybackSource {
  if (e.status === 'live' && isMuxId(e.muxPublicPlaybackId)) {
    return { kind: 'mux', playbackId: e.muxPublicPlaybackId, token: null, thumbnailToken: null, live: true, tracking: tracking() }
  }
  if (opts.preview && isMuxId(e.muxPrivatePlaybackId)) return signedSource(e.muxPrivatePlaybackId, true)
  const yt = youTubeIdOf(e.provider === 'mux' ? null : e.provider, e.providerRef)
  return yt ? { kind: 'youtube', id: yt } : { kind: 'none', reason: 'missing' }
}

/** Thumbnail for staff lists (queue, registry): signed, because unpublished media is private. */
export function staffThumbnail(v: MuxFields & { thumbnailUrl?: string | null }): string | null {
  if (v.thumbnailUrl?.startsWith('https://')) return v.thumbnailUrl
  if (v.provider !== 'mux') return null
  if (isMuxId(v.muxPublicPlaybackId)) return muxThumbnailUrl(v.muxPublicPlaybackId, { width: 320 })
  if (isMuxId(v.muxPrivatePlaybackId) && muxStatus().signing) {
    return muxThumbnailUrl(v.muxPrivatePlaybackId, { token: signPlaybackToken(v.muxPrivatePlaybackId, 't', THUMB_TOKEN_TTL) })
  }
  return null
}
