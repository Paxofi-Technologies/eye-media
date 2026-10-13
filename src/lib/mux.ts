import 'server-only'

/**
 * Mux Video client (https://www.mux.com/docs). Uses plain fetch: no SDK, nothing to break on cPanel.
 *
 * Environment variables (set in cPanel → Setup Node.js App, never in the repository):
 *   MUX_TOKEN_ID / MUX_TOKEN_SECRET        API access token (needs Mux Video read + write)
 *   MUX_WEBHOOK_SECRET                     signing secret of the webhook endpoint
 *   MUX_SIGNING_KEY_ID / MUX_SIGNING_KEY_PRIVATE   signing key for private (signed) playback
 * Optional:
 *   MUX_VIDEO_QUALITY       basic | plus | premium   (omit to use Mux's default)
 *   MUX_RECONNECT_WINDOW    seconds a live stream may drop before it counts as finished (omit = Mux default)
 *   MUX_DATA_ENABLED        true to send viewer analytics to Mux Data from the player (default off)
 *   MUX_API_BASE            for tests only
 */

const DEFAULT_BASE = 'https://api.mux.com'

export function muxBase(): string {
  return (process.env.MUX_API_BASE?.trim() || DEFAULT_BASE).replace(/\/+$/, '')
}

export type MuxStatus = { api: boolean; webhook: boolean; signing: boolean }

export function muxStatus(): MuxStatus {
  const e = process.env
  return {
    api: Boolean(e.MUX_TOKEN_ID?.trim() && e.MUX_TOKEN_SECRET?.trim()),
    webhook: Boolean(e.MUX_WEBHOOK_SECRET?.trim()),
    signing: Boolean(e.MUX_SIGNING_KEY_ID?.trim() && e.MUX_SIGNING_KEY_PRIVATE?.trim()),
  }
}

/** Uploads and live streams need the API token and the signing key (unpublished media is private). */
export function muxReady(): boolean {
  const s = muxStatus()
  return s.api && s.signing
}

export class MuxError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

type Json = Record<string, unknown>

export async function muxRequest<T = Json>(method: string, path: string, body?: Json): Promise<T> {
  const id = process.env.MUX_TOKEN_ID?.trim()
  const secret = process.env.MUX_TOKEN_SECRET?.trim()
  if (!id || !secret) throw new MuxError('Mux is not connected: MUX_TOKEN_ID / MUX_TOKEN_SECRET are not set.', 503)

  let res: Response
  try {
    res = await fetch(`${muxBase()}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
  } catch {
    throw new MuxError('Could not reach Mux. Check the server\'s internet connection and try again.', 502)
  }
  if (res.status === 204) return {} as T
  const json = (await res.json().catch(() => null)) as { data?: unknown; error?: { messages?: string[]; type?: string } } | null
  if (!res.ok) {
    const detail = json?.error?.messages?.join(' ') || json?.error?.type || `HTTP ${res.status}`
    const hint = res.status === 401 ? ' (the access token is wrong or revoked)' : res.status === 403 ? ' (the token lacks permission, or the plan does not include this feature)' : ''
    throw new MuxError(`Mux said: ${detail}${hint}`, res.status)
  }
  return (json?.data ?? {}) as T
}

/* ------------------------------------------------------------------ */
/* Shapes (only the fields we use)                                      */
/* ------------------------------------------------------------------ */

export type MuxPlaybackId = { id: string; policy: 'public' | 'signed' | 'drm' }

export type MuxDirectUpload = { id: string; url: string; status: string; asset_id?: string }
export type MuxAsset = {
  id: string
  status: 'preparing' | 'ready' | 'errored'
  duration?: number
  playback_ids?: MuxPlaybackId[]
  live_stream_id?: string
  errors?: { type?: string; messages?: string[] }
}
export type MuxSimulcastTarget = { id: string; url: string; status: string; passthrough?: string }
export type MuxLiveStream = {
  id: string
  stream_key: string
  status: 'idle' | 'active' | 'disabled'
  playback_ids?: MuxPlaybackId[]
  recent_asset_ids?: string[]
  simulcast_targets?: MuxSimulcastTarget[]
}

export const RTMP_URL = 'rtmp://global-live.mux.com:5222/app'
export const RTMPS_URL = 'rtmps://global-live.mux.com:443/app'

/* ------------------------------------------------------------------ */
/* Direct uploads & assets                                              */
/* ------------------------------------------------------------------ */

export function createDirectUpload(input: { corsOrigin: string; passthrough: string }) {
  const quality = process.env.MUX_VIDEO_QUALITY?.trim()
  return muxRequest<MuxDirectUpload>('POST', '/video/v1/uploads', {
    cors_origin: input.corsOrigin,
    new_asset_settings: {
      // Private until an editor publishes the story (a public playback id is added at that point).
      playback_policy: ['signed'],
      passthrough: input.passthrough,
      ...(quality ? { video_quality: quality } : {}),
    },
  })
}

export const getDirectUpload = (id: string) => muxRequest<MuxDirectUpload>('GET', `/video/v1/uploads/${encodeURIComponent(id)}`)
export const cancelDirectUpload = (id: string) => muxRequest('PUT', `/video/v1/uploads/${encodeURIComponent(id)}/cancel`)
export const getAsset = (id: string) => muxRequest<MuxAsset>('GET', `/video/v1/assets/${encodeURIComponent(id)}`)
export const deleteAsset = (id: string) => muxRequest('DELETE', `/video/v1/assets/${encodeURIComponent(id)}`)

export const addAssetPlaybackId = (assetId: string, policy: 'public' | 'signed') =>
  muxRequest<MuxPlaybackId>('POST', `/video/v1/assets/${encodeURIComponent(assetId)}/playback-ids`, { policy })
export const removeAssetPlaybackId = (assetId: string, playbackId: string) =>
  muxRequest('DELETE', `/video/v1/assets/${encodeURIComponent(assetId)}/playback-ids/${encodeURIComponent(playbackId)}`)

/* ------------------------------------------------------------------ */
/* Live streams                                                         */
/* ------------------------------------------------------------------ */

export function createLiveStream(passthrough: string) {
  const quality = process.env.MUX_VIDEO_QUALITY?.trim()
  const reconnect = Number(process.env.MUX_RECONNECT_WINDOW)
  return muxRequest<MuxLiveStream>('POST', '/video/v1/live-streams', {
    // Private until the event is taken live; the recording is private until a replay is published.
    playback_policy: ['signed'],
    new_asset_settings: { playback_policy: ['signed'], ...(quality ? { video_quality: quality } : {}) },
    passthrough,
    ...(Number.isFinite(reconnect) && reconnect > 0 ? { reconnect_window: reconnect } : {}),
  })
}

export const getLiveStream = (id: string) => muxRequest<MuxLiveStream>('GET', `/video/v1/live-streams/${encodeURIComponent(id)}`)
export const deleteLiveStream = (id: string) => muxRequest('DELETE', `/video/v1/live-streams/${encodeURIComponent(id)}`)
export const completeLiveStream = (id: string) => muxRequest('PUT', `/video/v1/live-streams/${encodeURIComponent(id)}/complete`)
export const resetStreamKey = (id: string) =>
  muxRequest<MuxLiveStream>('POST', `/video/v1/live-streams/${encodeURIComponent(id)}/reset-stream-key`)

export const addLivePlaybackId = (id: string, policy: 'public' | 'signed') =>
  muxRequest<MuxPlaybackId>('POST', `/video/v1/live-streams/${encodeURIComponent(id)}/playback-ids`, { policy })
export const removeLivePlaybackId = (id: string, playbackId: string) =>
  muxRequest('DELETE', `/video/v1/live-streams/${encodeURIComponent(id)}/playback-ids/${encodeURIComponent(playbackId)}`)

/** Simulcast: Mux forwards the stream to YouTube / Facebook / any RTMP destination. */
export const addSimulcastTarget = (liveId: string, input: { url: string; streamKey: string; passthrough?: string }) =>
  muxRequest<MuxSimulcastTarget>('POST', `/video/v1/live-streams/${encodeURIComponent(liveId)}/simulcast-targets`, {
    url: input.url,
    stream_key: input.streamKey,
    ...(input.passthrough ? { passthrough: input.passthrough } : {}),
  })
export const removeSimulcastTarget = (liveId: string, targetId: string) =>
  muxRequest('DELETE', `/video/v1/live-streams/${encodeURIComponent(liveId)}/simulcast-targets/${encodeURIComponent(targetId)}`)

export const policyId = (ids: MuxPlaybackId[] | undefined, policy: 'public' | 'signed') => ids?.find((p) => p.policy === policy)?.id ?? null
