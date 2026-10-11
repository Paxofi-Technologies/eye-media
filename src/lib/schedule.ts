/**
 * Schedule date helpers. Eye TV schedules run on West Africa Time (Lagos, UTC+1, no daylight saving),
 * so a "day" is midnight-to-midnight in Lagos regardless of the server's time zone.
 */
const LAGOS_OFFSET_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** 'YYYY-MM-DD' of the Lagos calendar day containing `date`. */
export function lagosDayKey(date: Date): string {
  return new Date(date.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10)
}

export function isDayKey(value: string | undefined | null): value is string {
  if (!value || !DAY_KEY.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** UTC instants bounding a Lagos calendar day: [start, end). */
export function lagosDayRange(dayKey: string): { start: Date; end: Date } {
  const start = new Date(new Date(`${dayKey}T00:00:00Z`).getTime() - LAGOS_OFFSET_MS)
  return { start, end: new Date(start.getTime() + DAY_MS) }
}

export function shiftDay(dayKey: string, days: number): string {
  return new Date(new Date(`${dayKey}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

export type StripDay = { key: string; day: string; month: string; weekday: string; isToday: boolean; isSelected: boolean }

/** Days shown in the schedule's date strip, centred on the selected day. */
export function dateStrip(selected: string, today: string, before = 3, after = 7): StripDay[] {
  const out: StripDay[] = []
  for (let i = -before; i <= after; i++) {
    const key = shiftDay(selected, i)
    const d = new Date(`${key}T12:00:00Z`)
    out.push({
      key,
      day: key.slice(8, 10),
      month: d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
      weekday: key === today ? 'TODAY' : d.toLocaleString('en-GB', { weekday: 'short', timeZone: 'UTC' }).toUpperCase(),
      isToday: key === today,
      isSelected: key === selected,
    })
  }
  return out
}

export type EventPhase = 'live' | 'upcoming' | 'starting' | 'ended' | 'cancelled'

/** What the public sees for an event. A scheduled event whose start has passed shows "starting" for 3h, then "ended". */
export function eventPhase(
  e: { status: 'scheduled' | 'live' | 'ended' | 'cancelled'; startsAt: Date; endsAt: Date | null },
  now: Date = new Date(),
): EventPhase {
  if (e.status === 'live') return 'live'
  if (e.status === 'cancelled') return 'cancelled'
  if (e.status === 'ended') return 'ended'
  if (e.startsAt.getTime() > now.getTime()) return 'upcoming'
  const graceEnd = (e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 60 * 60 * 1000)).getTime()
  return now.getTime() < graceEnd ? 'starting' : 'ended'
}

export const PHASE_LABELS: Record<EventPhase, string> = {
  live: 'Live now',
  upcoming: 'Upcoming',
  starting: 'Starting soon',
  ended: 'Ended',
  cancelled: 'Cancelled',
}

/** Request time for server components (each server render is a single request, so this is stable). */
export function requestTime(): Date {
  return new Date()
}
