import { isYouTubeId } from './youtube'

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024 // design system: "Max 500MB"
// Below Cloudflare's 100MB request cap and small enough to retry cheaply on mobile networks.
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'] as const
export const ACCEPTED_VIDEO_LABEL = 'MP4, MOV, WebM'

/**
 * Identify a video container from its first bytes. The browser-supplied type and file name are
 * never trusted: this is what decides what gets stored and the Content-Type it is served with.
 */
export function sniffVideoType(head: Uint8Array): (typeof ACCEPTED_VIDEO_TYPES)[number] | null {
  if (head.length < 12) return null
  // WebM / Matroska: EBML header 1A 45 DF A3
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm'
  // ISO base media (MP4, MOV, 3GP): "ftyp" box at offset 4, brand at 8..12
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to))
  if (ascii(4, 8) !== 'ftyp') return null
  const brand = ascii(8, 12)
  if (brand === 'qt  ') return 'video/quicktime'
  if (brand.startsWith('3g')) return 'video/3gpp'
  return 'video/mp4'
}

export type MediaSource = { youtubeId: string | null; uploadId: string | null }

/** What the player should load for a video or live event. */
export function mediaSource(provider: string | null | undefined, ref: string | null | undefined): MediaSource {
  if (!ref) return { youtubeId: null, uploadId: null }
  if (provider === 'upload') return { youtubeId: null, uploadId: ref }
  return { youtubeId: isYouTubeId(ref) ? ref : null, uploadId: null }
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}
