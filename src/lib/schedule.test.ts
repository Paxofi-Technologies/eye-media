import { describe, expect, it } from 'vitest'
import { dateStrip, eventPhase, isDayKey, lagosDayKey, lagosDayRange, shiftDay } from './schedule'

describe('Lagos day boundaries', () => {
  it('uses WAT (UTC+1) for the calendar day', () => {
    expect(lagosDayKey(new Date('2026-10-10T22:59:00Z'))).toBe('2026-10-10')
    expect(lagosDayKey(new Date('2026-10-10T23:00:00Z'))).toBe('2026-10-11')
  })
  it('returns the UTC range of a Lagos day', () => {
    const { start, end } = lagosDayRange('2026-10-11')
    expect(start.toISOString()).toBe('2026-10-10T23:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-11T23:00:00.000Z')
  })
  it('validates day keys strictly', () => {
    expect(isDayKey('2026-10-11')).toBe(true)
    expect(isDayKey('2026-02-30')).toBe(false)
    expect(isDayKey('2026-10-11T00')).toBe(false)
    expect(isDayKey("2026-10-11' or 1=1")).toBe(false)
    expect(isDayKey(undefined)).toBe(false)
  })
  it('shifts across month ends', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('dateStrip', () => {
  it('centres on the selected day and marks today', () => {
    const strip = dateStrip('2026-10-11', '2026-10-11', 3, 7)
    expect(strip).toHaveLength(11)
    expect(strip[0]!.key).toBe('2026-10-08')
    expect(strip[3]).toMatchObject({ key: '2026-10-11', weekday: 'TODAY', isToday: true, isSelected: true, month: 'OCT' })
    expect(strip[4]!.weekday).toBe('MON')
  })
})

describe('eventPhase', () => {
  const now = new Date('2026-10-11T12:00:00Z')
  const at = (iso: string) => new Date(iso)
  it('maps statuses', () => {
    expect(eventPhase({ status: 'live', startsAt: at('2026-10-11T10:00:00Z'), endsAt: null }, now)).toBe('live')
    expect(eventPhase({ status: 'cancelled', startsAt: at('2026-10-11T14:00:00Z'), endsAt: null }, now)).toBe('cancelled')
    expect(eventPhase({ status: 'ended', startsAt: at('2026-10-11T09:00:00Z'), endsAt: null }, now)).toBe('ended')
  })
  it('treats overdue scheduled events as starting, then ended', () => {
    expect(eventPhase({ status: 'scheduled', startsAt: at('2026-10-11T13:00:00Z'), endsAt: null }, now)).toBe('upcoming')
    expect(eventPhase({ status: 'scheduled', startsAt: at('2026-10-11T11:00:00Z'), endsAt: null }, now)).toBe('starting')
    expect(eventPhase({ status: 'scheduled', startsAt: at('2026-10-11T08:00:00Z'), endsAt: null }, now)).toBe('ended')
    expect(eventPhase({ status: 'scheduled', startsAt: at('2026-10-11T08:00:00Z'), endsAt: at('2026-10-11T13:00:00Z') }, now)).toBe('starting')
  })
})
