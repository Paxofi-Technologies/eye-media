import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // HSTS and X-Robots-Tag depend on runtime env, so src/proxy.ts sets them.
]

const nextConfig: NextConfig = {
  // The Docker image sets NEXT_OUTPUT=standalone for a minimal runtime; `npm start` uses the default.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['@node-rs/argon2'],
  // No next/image usage (thumbnails come from YouTube's CDN), so skip shipping sharp.
  images: { unoptimized: true },
  // Eye TV no longer takes public submissions (citizens report through Eye Report): keep old links working.
  async redirects() {
    return [{ source: '/tv/submit', destination: '/tv', permanent: true }]
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Never let shared caches store staff pages.
      { source: '/admin/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    ]
  },
}

export default nextConfig
