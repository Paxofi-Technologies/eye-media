import { z } from 'zod'
import { parseDuration } from './format'
import { SLUG_PATTERN } from './slug'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null)

// Unchecked checkboxes are absent from FormData entirely, so the key must be optional.
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === 'on' || v === 'true')

const optionalUuid = z
  .union([z.uuid(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null))

export const MODERATION_CHECKLIST = [
  { key: 'source', label: 'Source is a verified Eye Media reporter or staff member' },
  { key: 'safe', label: 'No graphic, violent or identifying-of-minors content' },
  { key: 'corroborated', label: 'Location and timestamp corroborated' },
  { key: 'policy', label: 'Matches Eye Media editorial policy tone & sourcing rules' },
] as const
export type ChecklistKey = (typeof MODERATION_CHECKLIST)[number]['key']

/* ---------------- Staff: auth ---------------- */

export const loginSchema = z.object({
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
})

export const PASSWORD_MIN = 12
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
  .max(200)

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  title: optionalText(160),
  role: z.enum(['admin', 'editor', 'moderator', 'media_manager', 'reporter']),
  password: passwordSchema,
})

/* ---------------- Staff: videos ---------------- */

export const videoSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v === '' || SLUG_PATTERN.test(v), 'Slug may only contain lowercase letters, numbers and hyphens.'),
  summary: optionalText(400),
  description: optionalText(10000),
  categoryId: optionalUuid,
  duration: z
    .string()
    .trim()
    .max(12)
    .transform((v, ctx) => {
      if (v === '') return null
      const s = parseDuration(v)
      if (s == null) {
        ctx.addIssue({ code: 'custom', message: 'Use m:ss or h:mm:ss.' })
        return z.NEVER
      }
      return s
    }),
  location: optionalText(160),
  tags: z
    .string()
    .max(500)
    .transform((v) =>
      Array.from(
        new Set(
          v
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .map((t) => t.slice(0, 40)),
        ),
      ).slice(0, 20),
    ),
  reporterName: optionalText(120),
  verified: checkbox,
  featured: checkbox,
  editorsPick: checkbox,
  sensitive: checkbox,
})

export const videoStatusChangeSchema = z.object({
  id: z.uuid(),
  status: z.enum(['draft', 'pending', 'published', 'unpublished']),
})

/* ---------------- Staff: moderation ---------------- */

export const moderationSchema = z.object({
  videoId: z.uuid(),
  decision: z.enum(['approved', 'rejected', 'flagged']),
  notes: optionalText(2000),
  checklist: z.record(z.string(), z.boolean()),
})

/* ---------------- Staff: live & schedule ---------------- */

// <input type="datetime-local"> value, interpreted as Lagos time (UTC+1, no DST).
const lagosDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Pick a date and time.')
  .transform((v) => new Date(`${v}:00+01:00`))

export const liveEventSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: optionalText(2000),
    categoryId: optionalUuid,
    city: optionalText(80),
    venue: optionalText(160),
    startsAt: lagosDateTime,
    endsAt: z.union([z.literal(''), lagosDateTime]).optional().transform((v) => (v ? v : null)),
    autoLive: checkbox,
    featured: checkbox,
  })
  .refine((d) => !d.endsAt || d.endsAt > d.startsAt, { message: 'End time must be after the start time.', path: ['endsAt'] })

export const liveEventStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(['scheduled', 'live', 'ended', 'cancelled']),
})

/* ---------------- helpers ---------------- */

export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of form.entries()) if (typeof value === 'string') out[key] = value
  return out
}

export type FieldErrors = Record<string, string>

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
