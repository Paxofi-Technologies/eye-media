/**
 * Fixed-window in-memory rate limiter. Adequate for a single-instance MVP deployment;
 * swap for a shared store (e.g. Redis) before running more than one app instance.
 */
type Bucket = { count: number; resetAt: number }

export class RateLimiter {
  private buckets = new Map<string, Bucket>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true if the action is allowed and records it. */
  hit(key: string, now: number = Date.now()): boolean {
    this.sweep(now)
    const bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }
    if (bucket.count >= this.limit) return false
    bucket.count++
    return true
  }

  reset(key: string) {
    this.buckets.delete(key)
  }

  private sweep(now: number) {
    if (this.buckets.size < 5000) return
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k)
  }
}
