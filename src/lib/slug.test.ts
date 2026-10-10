import { describe, expect, it } from 'vitest'
import { SLUG_PATTERN, slugify, videoSlug } from './slug'

describe('slugify', () => {
  it('produces clean slugs', () => {
    expect(slugify('Flood watch: Ajah — knee-deep water!')).toBe('flood-watch-ajah-knee-deep-water')
    expect(slugify('Traffic & Transport')).toBe('traffic-and-transport')
    expect(slugify('Café Ìdúmọ̀tà')).toBe('cafe-idumota')
  })
  it('always matches the slug pattern', () => {
    for (const t of ['  --hello--  ', 'A'.repeat(300), 'Ọjà Ọba', '1234']) {
      const s = videoSlug(t)
      expect(s).toMatch(SLUG_PATTERN)
      expect(s.length).toBeLessThanOrEqual(120)
    }
  })
  it('never collides with reserved routes', () => {
    expect(videoSlug('Live')).toBe('live-report')
    expect(videoSlug('Archive')).toBe('archive-report')
  })
  it('falls back when the title has no usable characters', () => {
    expect(videoSlug('!!!')).toBe('report')
  })
})
