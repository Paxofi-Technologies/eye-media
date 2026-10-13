import type { Metadata } from 'next'
import Link from 'next/link'
import { Thumb } from '@/components/tv/Thumb'
import { formatClock, formatDate } from '@/lib/format'
import {
  PHASE_LABELS,
  dateStrip,
  eventPhase,
  isDayKey,
  lagosDayKey,
  lagosDayRange,
  requestTime,
  shiftDay,
  type EventPhase,
} from '@/lib/schedule'
import { getScheduleCities, getScheduleForRange, type PublicLiveEvent } from '@/lib/tv'
import { CityFilter } from './CityFilter'

export const metadata: Metadata = {
  title: 'Live Schedule',
  description: 'Eye TV live broadcasts by day and city: what is on air now, what is coming up, and replays.',
  alternates: { canonical: '/tv/schedule' },
}

type Search = { date?: string; city?: string }

function scheduleHref(date: string, city: string | null) {
  const params = new URLSearchParams({ date })
  if (city) params.set('city', city)
  return `/tv/schedule?${params}`
}

function ScheduleRow({ event, phase, index }: { event: PublicLiveEvent; phase: EventPhase; index: number }) {
  const href = phase === 'ended' && event.replaySlug ? `/tv/${event.replaySlug}` : `/tv/live/${event.id}`
  return (
    <li className={`schedule-row phase-${phase}`}>
      <div className="schedule-time">
        <time dateTime={event.startsAt.toISOString()}>{formatClock(event.startsAt)}</time>
      </div>
      <Link className="schedule-thumb" href={href} tabIndex={-1} aria-hidden="true">
        <Thumb
          video={{ providerRef: event.providerRef }}
          alt={index % 2 === 1}
          chip={phase === 'live' ? null : phase === 'ended' && event.replaySlug ? 'Replay' : null}
          showPlay={phase === 'live' || Boolean(event.replaySlug)}
        />
        {phase === 'live' && (
          <span className="badge badge-live live-card-badge">
            <span className="pulse" />
            LIVE
          </span>
        )}
      </Link>
      <div className="schedule-main">
        <div className="schedule-kicker">
          {[event.categoryName, event.city].filter(Boolean).join(' · ') || 'Eye TV'}
        </div>
        <h3>
          <Link href={href}>{event.title}</Link>
        </h3>
        <div className="schedule-status">
          <span className={phase === 'live' ? 'badge badge-live' : 'badge badge-verified'}>{PHASE_LABELS[phase]}</span>
          {event.venue && <span className="byline">{event.venue}</span>}
          {phase === 'ended' && event.replaySlug && (
            <Link className="byline" href={href}>
              Watch replay →
            </Link>
          )}
        </div>
      </div>
      {event.description && <p className="schedule-desc">{event.description}</p>}
    </li>
  )
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const now = requestTime()
  const today = lagosDayKey(now)
  const date = isDayKey(sp.date) ? sp.date : today
  const cities = await getScheduleCities()
  const city = sp.city && cities.includes(sp.city) ? sp.city : null

  const { start, end } = lagosDayRange(date)
  const events = await getScheduleForRange(start, end, city)
  const withPhase = events.map((e) => ({ event: e, phase: eventPhase(e, now) }))
  const groups: { title: string; items: typeof withPhase }[] = [
    { title: 'Live now', items: withPhase.filter((x) => x.phase === 'live') },
    { title: 'Upcoming', items: withPhase.filter((x) => x.phase === 'upcoming' || x.phase === 'starting') },
    { title: date === today ? 'Earlier today' : 'Previously', items: withPhase.filter((x) => x.phase === 'ended' || x.phase === 'cancelled') },
  ].filter((g) => g.items.length > 0)

  const strip = dateStrip(date, today)

  return (
    <div className="wrap" style={{ paddingTop: 30, paddingBottom: 20 }}>
      <div className="schedule-head">
        <div>
          <h1>Live Schedule</h1>
          <p className="byline">All times are West Africa Time (Lagos, WAT).</p>
        </div>
        {cities.length > 0 && <CityFilter cities={cities} city={city} date={date} />}
      </div>

      <nav className="date-strip" aria-label="Choose a day">
        <Link className="date-arrow" href={scheduleHref(shiftDay(date, -7), city)} aria-label="Previous week">
          ←
        </Link>
        <ol>
          {strip.map((d) => (
            <li key={d.key}>
              <Link
                href={scheduleHref(d.key, city)}
                aria-current={d.isSelected ? 'date' : undefined}
                className={d.isToday ? 'is-today' : undefined}
              >
                <span className="m">{d.month}</span>
                <span className="d">{d.day}</span>
                <span className="w">{d.weekday}</span>
              </Link>
            </li>
          ))}
        </ol>
        <Link className="date-arrow" href={scheduleHref(shiftDay(date, 7), city)} aria-label="Next week">
          →
        </Link>
      </nav>

      <h2 className="visually-hidden">Broadcasts on {formatDate(start)}</h2>
      {groups.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <h3>No broadcasts {city ? `in ${city} ` : ''}on this day</h3>
          <p>
            Pick another day above
            {city ? (
              <>
                , or <Link href={scheduleHref(date, null)}>show all cities</Link>
              </>
            ) : null}
            .
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.title} className="schedule-group" aria-label={g.title}>
            <h3 className="schedule-group-title">{g.title}</h3>
            <ol className="schedule-rows">
              {g.items.map((x, i) => (
                <ScheduleRow key={x.event.id} event={x.event} phase={x.phase} index={i} />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}
