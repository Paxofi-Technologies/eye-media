// Public base URL from SITE_URL, tolerant of a trailing slash or stray spaces (e.g. "https://eyetv.paxofi.com/").
export function siteUrl(): string {
  return (process.env.SITE_URL ?? 'http://localhost:3000').trim().replace(/\/+$/, '')
}

export function isHttps(): boolean {
  return siteUrl().startsWith('https://')
}
