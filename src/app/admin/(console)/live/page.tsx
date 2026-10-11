import type { Metadata } from 'next'
import Link from 'next/link'
import { LiveEventActions } from '@/components/admin/LiveEventActions'
import { LiveEventForm } from '@/components/admin/LiveForms'
import { Restricted } from '@/components/admin/Restricted'
import { listLiveEventsForStaff } from '@/lib/admin'
import { requireStaff } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { can } from '@/lib/rbac'
import { requestTime } from '@/lib/schedule'
import { getCategories, getScheduleCities } from '@/lib/tv'

export const metadata: Metadata = { title: 'Live & Schedule' }

const STATUS_PILL: Record<string, string> = {
  live: 'status-live',
  scheduled: 'status-pending',
  ended: 'status-draft',
  cancelled: 'status-rejected',
}

export default async function LiveAdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireStaff()
  if (!can(user.role, 'live.manage')) {
    return <Restricted title="Not available for your role">Ask an editor or media manager to manage live streams.</Restricted>
  }
  const [events, categories, cities, sp] = await Promise.all([
    listLiveEventsForStaff(),
    getCategories(),
    getScheduleCities(),
    searchParams,
  ])
  const now = requestTime().getTime()
  const live = events.filter((e) => e.status === 'live')
  const upcoming = events.filter((e) => e.status !== 'live' && (e.status === 'scheduled' || e.startsAt.getTime() >= now))
  const recent = events.filter((e) => !live.includes(e) && !upcoming.includes(e)).reverse()
  const canMakeReplay = can(user.role, 'video.edit')

  const table = (title: string, rows: typeof events) => (
    <section className="form-panel" aria-label={title}>
      <h2>
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="field-hint">None.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">When (WAT)</th>
                <th scope="col">Event</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="cell-sub" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.startsAt)}</td>
                  <td>
                    <div className="cell-title">
                      <Link href={`/admin/live/${e.id}`}>{e.title}</Link>
                      {e.featured && <span className="cell-sub"> · featured</span>}
                    </div>
                    <div className="cell-sub">
                      {[e.categoryName, e.city, e.venue].filter(Boolean).join(' · ') || '—'}
                      {!e.providerRef && ' · no YouTube video yet'}
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${STATUS_PILL[e.status]}`}>{e.status}</span>
                  </td>
                  <td>
                    <LiveEventActions event={e} canMakeReplay={canMakeReplay} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Live &amp; Schedule</h1>
          <div className="sub">
            Any number of broadcasts can be live at once. Each event gets its own YouTube Live video, from any camera or phone.
          </div>
        </div>
        <Link className="btn btn-ghost" href="/tv/schedule" target="_blank">
          View public schedule ↗
        </Link>
      </div>
      {sp.error && <div className="alert alert-error" role="alert">{sp.error.slice(0, 200)}</div>}
      <div className="two-col">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {table('Live now', live)}
          {table('Upcoming', upcoming)}
          {table('Last 7 days', recent)}
        </div>
        <LiveEventForm initial={null} categories={categories} cities={cities} />
      </div>
    </>
  )
}
