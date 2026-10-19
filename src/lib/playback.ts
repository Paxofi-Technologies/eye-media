import { isYouTubeId } from './youtube'

/** Mux playback ids are alphanumeric; validate before putting one in a URL. */
const MUX_ID = /^[A-Za-z0-9]{8,100}$/
export const isMuxId = (v: string | null | undefined): v is string => Boolean(v && MUX_ID.test(v))

/** What a player should load. Built on the server; the private id is only ever present as a signed token. */
export type PlaybackSource =
  | { kind: 'none'; reason: 'missing' | 'processing' | 'errored' }
  | { kind: 'youtube'; id: string }
  | { kind: 'upload'; id: string }
  | {
      kind: 'mux'
      playbackId: string
      /** null for public playback; a short-lived signed token for staff previews. */
      token: string | null
      thumbnailToken: string | null
      live: boolean
      /** Mux Data viewer analytics: off unless MUX_DATA_ENABLED=true. */
      tracking: boolean
    }

/**
 * Image URL for a Mux playback id. Public ids can ask for a size; signed ids use the default
 * frame because image transformations on signed requests have to be baked into the token.
 */
export function muxThumbnailUrl(
  playbackId: string,
  opts: { token?: string | null; width?: number; format?: 'webp' | 'jpg' } = {},
): string {
  const params = new URLSearchParams()
  if (opts.token) params.set('token', opts.token)
  else if (opts.width) params.set('width', String(opts.width))
  const q = params.toString()
  return `https://image.mux.com/${playbackId}/thumbnail.${opts.format ?? 'webp'}${q ? `?${q}` : ''}`
}

export function youTubeIdOf(provider: string | null | undefined, ref: string | null | undefined): string | null {
  return (provider ?? 'youtube') === 'youtube' && isYouTubeId(ref ?? '') ? (ref as string) : null
}
