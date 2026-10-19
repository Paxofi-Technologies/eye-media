import { describe, expect, it } from 'vitest'
import { liveEventSchema, videoSchema } from './validation'

describe('videoSchema', () => {
  const base = {
    title: 'A video', slug: '', summary: '', description: '', categoryId: '',
    duration: '4:12', location: '', tags: 'Lagos, flooding, lagos, ', reporterName: '',
  }
  it('normalises fields', () => {
    const r = videoSchema.parse({ ...base, featured: 'on' })
    expect(r.duration).toBe(252)
    expect(r.tags).toEqual(['lagos', 'flooding'])
    expect(r.featured).toBe(true)
    expect(r.verified).toBe(false)
    expect(r.categoryId).toBeNull()
    expect(r.summary).toBeNull()
  })
  it('accepts only an https video link, or none', () => {
    expect(videoSchema.parse(base).videoUrl).toBeNull()
    expect(videoSchema.parse({ ...base, videoUrl: 'https://files.example.com/a.mp4' }).videoUrl).toBe('https://files.example.com/a.mp4')
    expect(videoSchema.safeParse({ ...base, videoUrl: 'http://files.example.com/a.mp4' }).success).toBe(false)
    expect(videoSchema.safeParse({ ...base, videoUrl: 'javascript:alert(1)' }).success).toBe(false)
  })
  it('rejects bad slugs', () => {
    expect(videoSchema.safeParse({ ...base, slug: 'Bad Slug' }).success).toBe(false)
  })
})

describe('liveEventSchema', () => {
  const base = { title: 'Weekly wrap', startsAt: '2026-10-10T21:00', categoryId: '' }
  it('interprets datetime-local as Lagos time', () => {
    const r = liveEventSchema.parse(base)
    expect(r.startsAt.toISOString()).toBe('2026-10-10T20:00:00.000Z')
    expect(r.endsAt).toBeNull()
    expect(r.featured).toBe(false)
  })
  it('rejects an end before the start', () => {
    expect(liveEventSchema.safeParse({ ...base, endsAt: '2026-10-10T20:00' }).success).toBe(false)
  })
  it('reads the automatic go-live checkbox', () => {
    expect(liveEventSchema.parse(base).autoLive).toBe(false)
    expect(liveEventSchema.parse({ ...base, autoLive: 'on' }).autoLive).toBe(true)
  })
})
