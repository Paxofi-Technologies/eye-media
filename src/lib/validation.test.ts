import { describe, expect, it } from 'vitest'
import { liveEventSchema, submissionSchema, videoSchema } from './validation'

const validSubmission = {
  title: 'Pothole on Ojota flyover',
  description: 'Large pothole causing cars to swerve during rush hour.',
  category: 'traffic-transport',
  location: 'Ojota, Lagos',
  mediaUrl: '',
  name: 'Ade',
  email: 'ade@example.com',
  phone: '',
  consent: 'on',
  website: '',
}

describe('submissionSchema', () => {
  it('accepts a valid submission', () => {
    const r = submissionSchema.safeParse(validSubmission)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.mediaUrl).toBeNull()
  })
  it('gives a friendly message when no category is chosen', () => {
    const r = submissionSchema.safeParse({ ...validSubmission, category: undefined })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues.find((i) => i.path[0] === 'category')?.message).toBe('Choose a category.')
  })
  it('requires consent', () => {
    expect(submissionSchema.safeParse({ ...validSubmission, consent: undefined }).success).toBe(false)
  })
  it('requires at least one contact method', () => {
    const r = submissionSchema.safeParse({ ...validSubmission, email: '', phone: '' })
    expect(r.success).toBe(false)
  })
  it('rejects non-https media links', () => {
    expect(submissionSchema.safeParse({ ...validSubmission, mediaUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(submissionSchema.safeParse({ ...validSubmission, mediaUrl: 'http://x.com/v' }).success).toBe(false)
  })
  it('flags the honeypot', () => {
    expect(submissionSchema.safeParse({ ...validSubmission, website: 'spam' }).success).toBe(false)
  })
})

describe('videoSchema', () => {
  const base = {
    title: 'A video', slug: '', summary: '', description: '', categoryId: '', youtube: 'https://youtu.be/SlbyzVMQ44w',
    duration: '4:12', location: '', tags: 'Lagos, flooding, lagos, ', reporterName: '',
  }
  it('normalises fields', () => {
    const r = videoSchema.parse({ ...base, featured: 'on' })
    expect(r.youtube).toBe('SlbyzVMQ44w')
    expect(r.duration).toBe(252)
    expect(r.tags).toEqual(['lagos', 'flooding'])
    expect(r.featured).toBe(true)
    expect(r.verified).toBe(false)
    expect(r.categoryId).toBeNull()
    expect(r.summary).toBeNull()
  })
  it('rejects bad YouTube input and slugs', () => {
    expect(videoSchema.safeParse({ ...base, youtube: 'https://vimeo.com/123' }).success).toBe(false)
    expect(videoSchema.safeParse({ ...base, slug: 'Bad Slug' }).success).toBe(false)
  })
})

describe('liveEventSchema', () => {
  const base = { title: 'Weekly wrap', startsAt: '2026-10-10T21:00', categoryId: '', youtube: '' }
  it('interprets datetime-local as Lagos time', () => {
    const r = liveEventSchema.parse(base)
    expect(r.startsAt.toISOString()).toBe('2026-10-10T20:00:00.000Z')
    expect(r.endsAt).toBeNull()
    expect(r.featured).toBe(false)
  })
  it('rejects an end before the start and bad YouTube input', () => {
    expect(liveEventSchema.safeParse({ ...base, endsAt: '2026-10-10T20:00' }).success).toBe(false)
    expect(liveEventSchema.safeParse({ ...base, youtube: 'https://vimeo.com/1' }).success).toBe(false)
  })
  it('accepts a YouTube Live URL', () => {
    expect(liveEventSchema.parse({ ...base, youtube: 'https://www.youtube.com/live/SlbyzVMQ44w' }).youtube).toBe('SlbyzVMQ44w')
  })
})
