// YouTube video ids are exactly 11 chars of [A-Za-z0-9_-]. Validating this strictly means an id
// can be interpolated into an embed URL without any risk of injecting other URL parts.
const YT_ID = /^[A-Za-z0-9_-]{11}$/

export function isYouTubeId(value: string): boolean {
  return YT_ID.test(value)
}

/** Accepts a bare id or any common YouTube URL form and returns the id, or null. */
export function parseYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null
  const value = input.trim()
  if (isYouTubeId(value)) return value

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replace(/^www\.|^m\./, '')

  let candidate: string | null = null
  if (host === 'youtu.be') {
    candidate = url.pathname.slice(1).split('/')[0] ?? null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(?:embed|live|shorts|v)\/([^/?#]+)/)
      candidate = m?.[1] ?? null
    }
  }
  return candidate && isYouTubeId(candidate) ? candidate : null
}

export function youTubeEmbedUrl(id: string, opts: { autoplay?: boolean } = {}): string {
  if (!isYouTubeId(id)) throw new Error('Invalid YouTube id')
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
  if (opts.autoplay) params.set('autoplay', '1')
  // Privacy-enhanced mode: no tracking cookies until the viewer presses play.
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`
}

export function youTubeThumbnail(id: string): string {
  if (!isYouTubeId(id)) throw new Error('Invalid YouTube id')
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}
