const TZ = 'Africa/Lagos'

export function formatDuration(totalSeconds: number | null | undefined): string | null {
  if (totalSeconds == null || totalSeconds < 0) return null
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Parses "m:ss" / "h:mm:ss" / plain seconds. Returns null for empty or malformed input. */
export function parseDuration(input: string | null | undefined): number | null {
  if (!input) return null
  const value = input.trim()
  if (!value) return null
  if (/^\d+$/.test(value)) return Number(value)
  const parts = value.split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.slice(1).some((n) => n >= 60)) return null
  return nums.reduce((acc, n) => acc * 60 + n, 0)
}

export function timeAgo(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return ''
  const diff = Math.max(0, now.getTime() - date.getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return formatDate(date)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(date)
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  }).format(date)
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(date)
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-NG').format(n)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}
