import { describe, expect, it } from 'vitest'
import { eyeReportPayloadSchema } from './eye-report-schema'

const ok = { externalId: 'ER-1042', title: 'Pothole on Ojota flyover', videoUrl: 'https://files.example.com/v/1042.mp4?sig=abc' }

describe('eyeReportPayloadSchema', () => {
  it('accepts a minimal hand-over', () => {
    expect(eyeReportPayloadSchema.safeParse(ok).success).toBe(true)
  })
  it('refuses any extra field, so citizen details can never cross over', () => {
    for (const extra of [{ phone: '+234800' }, { email: 'a@b.com' }, { reporterName: 'Ade' }, { name: 'Ade' }]) {
      expect(eyeReportPayloadSchema.safeParse({ ...ok, ...extra }).success).toBe(false)
    }
  })
  it('requires an https video link', () => {
    expect(eyeReportPayloadSchema.safeParse({ ...ok, videoUrl: 'http://x.com/v.mp4' }).success).toBe(false)
    expect(eyeReportPayloadSchema.safeParse({ ...ok, videoUrl: 'javascript:alert(1)' }).success).toBe(false)
  })
  it('restricts the external id and category slug', () => {
    expect(eyeReportPayloadSchema.safeParse({ ...ok, externalId: 'a b' }).success).toBe(false)
    expect(eyeReportPayloadSchema.safeParse({ ...ok, category: 'Public Safety' }).success).toBe(false)
    expect(eyeReportPayloadSchema.safeParse({ ...ok, category: 'public-safety' }).success).toBe(true)
  })
})
