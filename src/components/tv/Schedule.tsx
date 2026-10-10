import { formatClock } from '@/lib/format'

type Slot = { id: string; title: string; startsAt: Date; categoryName: string | null; onNow: boolean }

export function SchedulePanel({ heading, slots, liveTitle }: { heading: string; slots: Slot[]; liveTitle?: string | null }) {
  return (
    <section className="panel" aria-label={heading}>
      <h2 className="head">{heading}</h2>
      {slots.length === 0 && !liveTitle ? (
        <p className="empty">The programme schedule will appear here.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {liveTitle && (
            <li className="schedule-item">
              <div className="time">Now</div>
              <div>
                <div className="title">{liveTitle}</div>
                <div className="cat">Live on Eye TV</div>
              </div>
            </li>
          )}
          {slots.map((s) => (
            <li className="schedule-item" key={s.id}>
              <div className="time">
                <time dateTime={s.startsAt.toISOString()}>
                  {s.onNow ? 'On now' : formatClock(s.startsAt)}
                </time>
              </div>
              <div>
                <div className="title">{s.title}</div>
                {s.categoryName && <div className="cat">{s.categoryName}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
