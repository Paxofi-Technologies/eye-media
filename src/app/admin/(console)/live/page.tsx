import type { Metadata } from 'next'
import { deleteScheduleItem, setLiveStatus } from '@/app/admin/actions'
import { LiveSettingsForm, ScheduleForm } from '@/components/admin/LiveForms'
import { Restricted } from '@/components/admin/Restricted'
import { getLiveSettings, getScheduleForStaff } from '@/lib/admin'
import { requireStaff } from '@/lib/auth'
import { formatClock, formatDateTime } from '@/lib/format'
import { can } from '@/lib/rbac'
import { getCategories } from '@/lib/tv'

export const metadata: Metadata = { title: 'Live & Schedule' }

export default async function LiveAdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireStaff()
  if (!can(user.role, 'live.manage')) {
    return <Restricted title="Not available for your role">Ask an editor or media manager to manage live streams.</Restricted>
  }
  const [live, schedule, categories, sp] = await Promise.all([getLiveSettings(), getScheduleForStaff(), getCategories(), searchParams])
  const isLive = live?.status === 'live'

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Live &amp; Schedule</h1>
          <div className="sub">Configure the YouTube Live broadcast that powers the public Live page, and the programme schedule.</div>
        </div>
      </div>
      {sp.error && <div className="alert alert-error" role="alert">{sp.error.slice(0, 200)}</div>}

      <div className="two-col">
        <div>
          <LiveSettingsForm initial={live} categories={categories} />
        </div>
        <div>
          <div className={isLive ? 'live-status-card is-live' : 'live-status-card'}>
            <span className="dot-big" aria-hidden="true" />
            <span className="status-word">{isLive ? 'LIVE ON EYE TV' : 'OFF AIR'}</span>
            {isLive && live?.startedAt && (
              <div style={{ color: 'var(--fg-lo)', fontSize: '0.8rem', marginTop: 8 }}>Started {formatClock(live.startedAt)}</div>
            )}
            <form action={setLiveStatus}>
              <input type="hidden" name="status" value={isLive ? 'offline' : 'live'} />
              <button className={isLive ? 'btn btn-ghost' : 'btn btn-primary'} type="submit">
                {isLive ? 'End stream on Eye TV' : 'Go live on Eye TV'}
              </button>
            </form>
            <p className="field-hint">Start the broadcast in YouTube Studio first, then switch Eye TV to live.</p>
          </div>

          {can(user.role, 'schedule.manage') && (
            <div className="form-panel" style={{ marginTop: 16 }}>
              <h2>Schedule</h2>
              {schedule.length === 0 ? (
                <p className="field-hint">No upcoming programmes.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
                  {schedule.map((s) => (
                    <li key={s.id} className="cell-flex" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div className="cell-title" style={{ fontSize: '0.85rem' }}>{s.title}</div>
                        <div className="cell-sub">{formatDateTime(s.startsAt)}{s.categoryName ? ` · ${s.categoryName}` : ''}</div>
                      </div>
                      <form action={deleteScheduleItem}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn btn-ghost btn-sm" type="submit" aria-label={`Remove ${s.title}`}>Remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <ScheduleForm categories={categories} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
