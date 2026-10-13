import Link from 'next/link'
import { pageItems } from '@/lib/pagination'

/**
 * Numbered pagination (design system: PREVIOUS · 1 2 3 … 12 · NEXT, active page solid red).
 * `href` builds the link for a page so each list keeps its own filters in the URL.
 */
export function Pagination({ page, pages, href, label = 'Pagination' }: { page: number; pages: number; href: (p: number) => string; label?: string }) {
  if (pages <= 1) return null
  return (
    <nav className="pager" aria-label={label}>
      {page > 1 ? (
        <Link className="pager-btn" href={href(page - 1)} rel="prev">
          Previous
        </Link>
      ) : (
        <span className="pager-btn is-disabled" aria-disabled="true">
          Previous
        </span>
      )}
      <ol>
        {pageItems(page, pages).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} className="pager-gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <Link className="pager-num" href={href(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p}`}>
                {p}
              </Link>
            </li>
          ),
        )}
      </ol>
      {page < pages ? (
        <Link className="pager-btn" href={href(page + 1)} rel="next">
          Next
        </Link>
      ) : (
        <span className="pager-btn is-disabled" aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  )
}
