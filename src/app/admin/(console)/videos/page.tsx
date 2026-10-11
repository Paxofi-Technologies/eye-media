/* eslint-disable @next/next/no-img-element -- thumbnails are served by YouTube's image CDN */
import type { Metadata } from 'next'
import Link from 'next/link'
import { z } from 'zod'
import { STATUS_OPTIONS, StatusPill } from '@/components/admin/StatusPill'
import { Pagination } from '@/components/Pagination'
import { thumbnailFor } from '@/components/tv/Thumb'
import type { VideoStatus } from '@/db/schema'
import { REGISTRY_PAGE_SIZE, getLiveCount, getVideoStats, listVideos } from '@/lib/admin'
import { requireStaff } from '@/lib/auth'
import { formatCount, timeAgo } from '@/lib/format'
import { parsePage } from '@/lib/pagination'
import { can } from '@/lib/rbac'
import { getCategories } from '@/lib/tv'

export const metadata: Metadata = { title: 'Video Registry' }

type Search = { q?: string; category?: string; status?: string; page?: string }

export default async function RegistryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireStaff()
  const sp = await searchParams
  const q = (sp.q ?? '').slice(0, 100)
  const categoryId = z.uuid().safeParse(sp.category).success ? sp.category! : null
  const status = STATUS_OPTIONS.some(([s]) => s === sp.status) ? (sp.status as VideoStatus) : null
  const page = parsePage(sp.page)

  const [stats, categories, liveCount, { rows, total }] = await Promise.all([
    getVideoStats(),
    getCategories(),
    getLiveCount(),
    listVideos({ q, categoryId, status, page }),
  ])
  const pages = Math.max(1, Math.ceil(total / REGISTRY_PAGE_SIZE))
  const href = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (categoryId) params.set('category', categoryId)
    if (status) params.set('status', status)
    params.set('page', String(p))
    return `/admin/videos?${params}`
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Video Registry</h1>
          <div className="sub">Every video across Eye TV, with publication status and metadata.</div>
        </div>
        {can(user.role, 'video.edit') && (
          <Link className="btn btn-primary" href="/admin/videos/new">
            + New video
          </Link>
        )}
      </div>

      <div className="stat-cards">
        <Link className="stat-card" href="/admin/videos?status=published">
          <div className="n">{stats.published ?? 0}</div>
          <div className="l">Published</div>
        </Link>
        <Link className="stat-card" href="/admin/videos?status=pending">
          <div className="n">{(stats.pending ?? 0) + (stats.flagged ?? 0)}</div>
          <div className="l">Awaiting review</div>
        </Link>
        <Link className="stat-card" href="/admin/live">
          <div className="n">{liveCount}</div>
          <div className="l">Live now</div>
        </Link>
        <Link className="stat-card" href="/admin/videos?status=rejected">
          <div className="n">{stats.rejected ?? 0}</div>
          <div className="l">Rejected</div>
        </Link>
      </div>

      <form className="table-toolbar" method="get" action="/admin/videos" role="search">
        <label className="visually-hidden" htmlFor="rq">Search videos</label>
        <input id="rq" type="search" name="q" defaultValue={q} placeholder="Search title, reporter or YouTube id…" maxLength={100} />
        <label className="visually-hidden" htmlFor="rc">Category</label>
        <select id="rc" name="category" defaultValue={categoryId ?? ''}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="rs">Status</label>
        <select id="rs" name="status" defaultValue={status ?? ''}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(([s, label]) => (
            <option key={s} value={s}>{label}</option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" type="submit">Filter</button>
      </form>

      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>No videos match</h3>
          <p>Adjust the filters, or create a new video.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Category</th>
                <th scope="col">Reporter</th>
                <th scope="col">Status</th>
                <th scope="col">Views</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const thumb = thumbnailFor(r)
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="cell-flex">
                        <div className="row-thumb">{thumb && <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />}</div>
                        <div>
                          <div className="cell-title">
                            <Link href={`/admin/videos/${r.id}`}>{r.title}</Link>
                          </div>
                          <div className="cell-sub">{r.provider === 'upload' ? 'File upload' : `YT: ${r.providerRef ?? '—'}`}{r.source === 'citizen' ? ' · citizen' : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>{r.categoryName ?? '—'}</td>
                    <td>{r.reporterName ?? '—'}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td>{r.status === 'published' ? formatCount(r.viewCount) : '—'}</td>
                    <td className="cell-sub">{timeAgo(r.updatedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} href={href} label="Video registry pages" />
      {total > 0 && (
        <p className="cell-sub" style={{ textAlign: 'center', marginTop: 10 }}>
          Showing {(page - 1) * REGISTRY_PAGE_SIZE + 1}–{Math.min(page * REGISTRY_PAGE_SIZE, total)} of {total}
        </p>
      )}
    </>
  )
}
