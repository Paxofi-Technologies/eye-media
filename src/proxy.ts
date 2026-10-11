import { NextResponse, type NextRequest } from 'next/server'
import { isHttps } from '@/lib/site'

const SESSION_COOKIES = ['eye_session', '__Host-eye_session']

// Read at runtime so one build serves staging and production.
// Only upgrade sub-resources / send HSTS when the site is actually served over HTTPS.
const HTTPS = isHttps()
// Search engines may index the site only when explicitly enabled (production). Staging stays hidden.
const INDEXING = process.env.SITE_INDEXING?.trim() === 'true'

function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === 'development'
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Inline style attributes cannot carry a nonce; style injection is low-risk compared to script.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://i.ytimg.com`,
    `font-src 'self'`,
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    `frame-src https://www.youtube-nocookie.com`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    HTTPS ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Optimistic gate for the admin console. Every admin page and server action still verifies the
  // session and permissions against the database; this only avoids rendering for signed-out visitors.
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name))
    if (!hasSession) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname + search)}`
      return NextResponse.redirect(url)
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = contentSecurityPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  if (HTTPS) response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  if (!INDEXING || pathname.startsWith('/admin')) response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|media|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
