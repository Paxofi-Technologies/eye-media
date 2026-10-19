import { describe, expect, it } from 'vitest'
import { backoffMs } from './eye-report-backoff'

describe('backoffMs', () => {
  it('doubles from one minute and stops at six hours', () => {
    expect(backoffMs(1)).toBe(60_000)
    expect(backoffMs(2)).toBe(120_000)
    expect(backoffMs(4)).toBe(480_000)
    expect(backoffMs(20)).toBe(6 * 60 * 60_000)
  })
})
