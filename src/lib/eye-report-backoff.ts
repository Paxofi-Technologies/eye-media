/** 1 min, 2, 4, 8 … capped at 6 hours. */
export function backoffMs(attempts: number): number {
  return Math.min(2 ** Math.max(0, attempts - 1) * 60_000, 6 * 60 * 60_000)
}
