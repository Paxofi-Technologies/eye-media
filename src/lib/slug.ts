export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '')
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Top-level /tv/* routes that a video slug must never shadow.
export const RESERVED_SLUGS = new Set(['live', 'archive', 'submit', 'editorial-policy', 'search', 'category', 'new'])

/** Builds a URL-safe slug that never collides with reserved routes. `suffix` disambiguates duplicates. */
export function videoSlug(title: string, suffix?: string): string {
  const base = slugify(title) || 'report'
  const slug = suffix ? `${base.slice(0, 120 - suffix.length - 1)}-${suffix}` : base
  return RESERVED_SLUGS.has(slug) ? `${slug}-report` : slug
}
