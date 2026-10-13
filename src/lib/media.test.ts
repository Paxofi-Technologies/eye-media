import { describe, expect, it } from 'vitest'
import { formatBytes } from './media'

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(300 * 1024 * 1024)).toBe('300 MB')
  })
})
