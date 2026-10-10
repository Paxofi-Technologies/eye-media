import Link from 'next/link'
import '@/styles/public.css'
import { Logo } from '@/components/Logo'
import { NavLinks } from '@/components/tv/NavLinks'
import { getLatest } from '@/lib/tv'

export const dynamic = 'force-dynamic'

export default async function TvLayout({ children }: { children: React.ReactNode }) {
  const headlines = await getLatest(6)

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site">
        {headlines.length > 0 && (
          <div className="ticker">
            <div className="ticker-inner">
              <span className="ticker-label">ON AIR</span>
              <div className="ticker-track">
                {/* Rendered twice for a seamless loop; the duplicate is hidden from assistive tech. */}
                {[0, 1].map((copy) =>
                  headlines.map((h) => (
                    <Link
                      key={`${copy}-${h.id}`}
                      href={`/tv/${h.slug}`}
                      aria-hidden={copy === 1 ? true : undefined}
                      tabIndex={copy === 1 ? -1 : undefined}
                    >
                      {h.title}
                    </Link>
                  )),
                )}
              </div>
            </div>
          </div>
        )}
        <div className="header-row">
          <Logo href="/tv" sub="TV" label="Eye TV home" />
          <NavLinks />
          <div className="header-actions">
            <Link className="search-pill" href="/tv/archive" aria-label="Search Eye TV">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.6" y2="16.6" />
              </svg>
              <span>Search Eye TV</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="site">
        <div className="fdots" />
        <div className="wrap">
          <div className="footer-values" aria-hidden="true">
            PEOPLE <span>|</span> STORIES <span>|</span> ACCOUNTABILITY
          </div>
          <div className="footer-grid">
            <div>
              <Logo href="/tv" sub="TV" label="Eye TV home" />
              <p style={{ maxWidth: '36ch', margin: '12px 0 0' }}>
                A citizen-powered broadcast platform for Lagos, part of Eye Media Group. Truth, for a more informed
                tomorrow.
              </p>
            </div>
            <div>
              <h2>Eye TV</h2>
              <ul>
                <li><Link href="/tv/live">Live &amp; schedule</Link></li>
                <li><Link href="/tv/archive">Archive</Link></li>
                <li><Link href="/tv/editorial-policy">Editorial policy</Link></li>
              </ul>
            </div>
            <div>
              <h2>Get involved</h2>
              <ul>
                <li><Link href="/tv/submit">Report a story</Link></li>
                <li><Link href="/tv/editorial-policy#submissions">How submissions are reviewed</Link></li>
              </ul>
            </div>
            <div>
              <h2>Eye Media Group</h2>
              <ul>
                <li>EyeReport — coming soon</li>
                <li>Eye News — coming soon</li>
                <li>Eye Photo — coming soon</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Eye Media Group · Lagos, Nigeria</span>
            <span>
              <Link href="/admin">Staff sign-in</Link> · Consistent. Credible. Impactful.
            </span>
          </div>
        </div>
      </footer>
    </>
  )
}
