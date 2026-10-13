import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import { siteUrl } from '@/lib/site'
import '@/styles/tokens.css'
import '@/styles/base.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'Eye TV — A Clearer Tomorrow', template: '%s · Eye TV' },
  description:
    'Eye TV is the citizen-powered video newsroom of Eye Media Group: verified reports, live coverage and programmes from Lagos.',
  applicationName: 'Eye TV',
  openGraph: { siteName: 'Eye TV', type: 'website', locale: 'en_NG' },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  themeColor: '#0B0B0B',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  )
}
