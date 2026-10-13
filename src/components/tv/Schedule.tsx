import Link from 'next/link'
import { formatClock } from '@/lib/format'
import { eventPhase } from '@/lib/schedule'

type Slot = {
  id: string
  title: string
  startsAt: Date
  endsAt: Date | null
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  categoryName: string | null
  city: string | null
}

/** Compact "Up next" list used beside the hero on Home and Live. */
export function SchedulePanel({ heading, slots, now }: { heading: string; slots: Slot[]; now: Date }) {
  return (
    <section className="panel" aria-label={heading}>
      <h2 className="head">{heading}</h2>
      {slots.length === 0 ? (
        <p className="empty">Nothing scheduled right now. Check the full schedule for upcoming broadcasts.</p>
      ) : (
        <ul className="schedule-list">
          {slots.map((s) => {
            const phase = eventPhase(s, now)
            return (
              <li className="schedule-item" key={s.id}>
                <div className="time">
                  {phase === 'live' ? (
                    <span className="badge badge-live">
                      <span className="pulse" />
                      LIVE
                    </span>
                  ) : (
                    <time dateTime={s.startsAt.toISOString()}>{formatClock(s.startsAt)}</time>
                  )}
                </div>
                <div>
                  <Link className="title" href={`/tv/live/${s.id}`}>
                    {s.title}
                  </Link>
                  <div className="cat">{[s.categoryName, s.city].filter(Boolean).join(' · ')}</div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="panel-foot">
        <Link className="see-all" href="/tv/schedule">
          Full schedule →
        </Link>
      </div>
    </section>
  )
}
