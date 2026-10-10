import type { Metadata } from 'next'
import Link from 'next/link'
import { VideoCard } from '@/components/tv/VideoCard'
import { DATE_RANGES, PAGE_SIZE, getCategories, searchVideos, type DateRange } from '@/lib/tv'

export const metadata: Metadata = {
  title: 'Archive',
  description: 'Search every verified Eye TV report by keyword, category and date.',
  alternates: { canonical: '/tv/archive' },
}

type Search = Record<string, string | string[] | undefined>

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : [])
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function ArchivePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const q = first(sp.q).slice(0, 100)
  const rangeParam = first(sp.range)
  const range: DateRange = rangeParam in DATE_RANGES ? (rangeParam as DateRange) : 'all'
  const verifiedOnly = first(sp.verified) === '1'
  const categories = await getCategories()
  const validSlugs = new Set(categories.map((c) => c.slug))
  const selected = list(sp.category).filter((s) => validSlugs.has(s))
  const page = Math.max(1, Math.min(500, Number.parseInt(first(sp.page), 10) || 1))

  const { rows, total } = await searchVideos({ q, categories: selected, verifiedOnly, range, page })
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const pageHref = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    selected.forEach((s) => params.append('category', s))
    if (verifiedOnly) params.set('verified', '1')
    params.set('range', range)
    params.set('page', String(p))
    return `/tv/archive?${params}`
  }

  return (
    <div className="wrap" style={{ paddingTop: 30, paddingBottom: 20 }}>
      <div className="section-head" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 20 }}>
        <h1>Archive</h1>
      </div>
      {/* Plain GET form: works without JavaScript and produces shareable URLs. */}
      <form action="/tv/archive" method="get" role="search">
        <div className="search-row">
          <label htmlFor="q" className="visually-hidden">
            Search Eye TV archive
          </label>
          <input
            id="q"
            className="search-input"
            type="search"
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder='Search verified reports, e.g. "Third Mainland Bridge"'
          />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </div>
        <div className="archive-layout">
          <aside className="filter-box" aria-label="Filters">
            <div className="fh">FILTERS</div>
            <fieldset className="filter-group">
              <legend>Category</legend>
              {categories.map((c) => (
                <label className="check" key={c.id}>
                  <input type="checkbox" name="category" value={c.slug} defaultChecked={selected.includes(c.slug)} />
                  {c.name}
                </label>
              ))}
            </fieldset>
            <fieldset className="filter-group">
              <legend>Verification</legend>
              <label className="check">
                <input type="checkbox" name="verified" value="1" defaultChecked={verifiedOnly} /> Verified only
              </label>
            </fieldset>
            <fieldset className="filter-group">
              <legend>Date</legend>
              {(
                [
                  ['7d', 'Last 7 days'],
                  ['30d', 'Last 30 days'],
                  ['all', 'All time'],
                ] as const
              ).map(([value, label]) => (
                <label className="check" key={value}>
                  <input type="radio" name="range" value={value} defaultChecked={range === value} /> {label}
                </label>
              ))}
            </fieldset>
            <div className="filter-actions">
              <button className="btn btn-primary btn-sm" type="submit">
                Apply
              </button>
              <Link className="btn btn-ghost btn-sm" href="/tv/archive">
                Reset
              </Link>
            </div>
          </aside>

          <div>
            <p className="result-count" role="status">
              {total} {verifiedOnly ? 'verified ' : ''}
              {total === 1 ? 'report' : 'reports'}
              {q && <> for &ldquo;{q}&rdquo;</>}
            </p>
            {rows.length === 0 ? (
              <div className="empty-state">
                <h3>No reports match</h3>
                <p>Try a different keyword, widen the date range or clear the category filters.</p>
              </div>
            ) : (
              <div className="grid-3">
                {rows.map((v, i) => (
                  <VideoCard key={v.id} video={v} index={i} />
                ))}
              </div>
            )}
            {pages > 1 && (
              <nav className="pagination" aria-label="Pagination">
                {page > 1 && (
                  <Link className="btn btn-ghost btn-sm" href={pageHref(page - 1)}>
                    ← Newer
                  </Link>
                )}
                <span>
                  Page {page} of {pages}
                </span>
                {page < pages && (
                  <Link className="btn btn-ghost btn-sm" href={pageHref(page + 1)}>
                    Older →
                  </Link>
                )}
              </nav>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
