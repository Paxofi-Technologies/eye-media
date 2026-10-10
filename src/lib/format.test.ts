import { describe, expect, it } from 'vitest'
import { formatDuration, initials, parseDuration, timeAgo } from './format'

describe('durations', () => {
  it('formats and parses round-trip', () => {
    for (const s of [0, 5, 65, 412, 3600, 3725]) expect(parseDuration(formatDuration(s))).toBe(s)
  })
  it('formats hours', () => expect(formatDuration(3725)).toBe('1:02:05'))
  it('rejects malformed input', () => {
    expect(parseDuration('4:75')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('1:2:3:4')).toBeNull()
    expect(parseDuration('')).toBeNull()
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-10-10T12:00:00Z')
  it('uses relative units', () => {
    expect(timeAgo(new Date('2026-10-10T11:59:40Z'), now)).toBe('just now')
    expect(timeAgo(new Date('2026-10-10T11:30:00Z'), now)).toBe('30m ago')
    expect(timeAgo(new Date('2026-10-10T07:00:00Z'), now)).toBe('5h ago')
    expect(timeAgo(new Date('2026-10-08T12:00:00Z'), now)).toBe('2d ago')
  })
})

describe('initials', () => {
  it('takes up to two', () => expect(initials('Ngozi  Fadipe Ade')).toBe('NF'))
})
