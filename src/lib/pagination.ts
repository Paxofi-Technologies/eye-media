/**
 * Page numbers to show, with gaps collapsed to null ("…"), e.g. [1, null, 4, 5, 6, null, 12].
 * Always includes the first and last page and `siblings` pages either side of the current one.
 */
export function pageItems(page: number, pages: number, siblings = 1): (number | null)[] {
  if (pages <= 1) return [1]
  const current = Math.min(Math.max(1, page), pages)
  const set = new Set<number>([1, pages])
  for (let p = current - siblings; p <= current + siblings; p++) if (p >= 1 && p <= pages) set.add(p)
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | null)[] = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined && p - prev === 2) out.push(prev + 1)
    else if (prev !== undefined && p - prev > 2) out.push(null)
    out.push(p)
  })
  return out
}

/** Clamp a ?page= query value to a sane page number. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10_000) : 1
}
