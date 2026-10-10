import { describe, expect, it } from 'vitest'
import { RateLimiter } from './rate-limit'

describe('RateLimiter', () => {
  it('allows up to the limit within a window, then blocks', () => {
    const rl = new RateLimiter(3, 1000)
    expect([rl.hit('a', 0), rl.hit('a', 1), rl.hit('a', 2), rl.hit('a', 3)]).toEqual([true, true, true, false])
    expect(rl.hit('b', 3)).toBe(true)
  })
  it('resets after the window', () => {
    const rl = new RateLimiter(1, 1000)
    expect(rl.hit('a', 0)).toBe(true)
    expect(rl.hit('a', 500)).toBe(false)
    expect(rl.hit('a', 1000)).toBe(true)
  })
})
