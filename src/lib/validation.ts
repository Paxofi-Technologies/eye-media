import { z } from 'zod'
import { parseYouTubeId } from './youtube'
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
  { key: 'source', label: 'Source is a verified reporter or cross-checked citizen upload' },
  { key: 'safe', label: 'No graphic, violent or identifying-of-minors content' },
  { key: 'corroborated', label: 'Location and timestamp corroborated' },
  { key: 'policy', label: 'Matches Eye Media editorial policy tone & sourcing rules' },
] as const
export type ChecklistKey = (typeof MODERATION_CHECKLIST)[number]['key']

/* ---------------- Public: citizen story submission ---------------- */

export const submissionSchema = z
  .object({
    title: z.string().trim().min(8, 'Give your story a short headline (8+ characters).').max(200),
    description: z
      .string()
      .trim()
      .min(20, 'Describe what happened in a little more detail (20+ characters).')
      .max(4000),
    category: z.string().trim().regex(SLUG_PATTERN, 'Choose a category.'),
    location: z.string().trim().min(2, 'Tell us where this happened.').max(160),
    mediaUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https:\/\/[^\s]+$/i.test(v), 'Use a full https:// link to your video.')
      .transform((v) => (v === '' ? null : v)),
    name: z.string().trim().min(2, 'Enter your name.').max(120),
    email: z
      .union([z.literal(''), z.email('Enter a valid email address.').max(254)])
      .transform((v) => (v === '' ? null : v.toLowerCase())),
    phone: z
      .string()
      .trim()
      .max(40)
      .refine((v) => v === '' || /^\+?[0-9 ()-]{7,}$/.test(v), 'Enter a valid phone number.')
      .transform((v) => (v === '' ? null : v)),
    consent: z.literal('on', { error: 'You must accept the submission terms.' }),
    // Honeypot: real users never see or fill this field.
    website: z.string().max(0).optional().default(''),
  })
  .refine((d) => d.email || d.phone, { message: 'Give us an email or phone number so an editor can reach you.', path: ['email'] })

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
  youtube: z
    .string()
    .trim()
    .max(200)
    .transform((v, ctx) => {
      if (v === '') return null
      const id = parseYouTubeId(v)
      if (!id) {
        ctx.addIssue({ code: 'custom', message: 'Enter a YouTube video id or URL.' })
        return z.NEVER
      }
      return id
    }),
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

export const liveSettingsSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: optionalText(2000),
  categoryId: optionalUuid,
  youtube: z
    .string()
    .trim()
    .max(200)
    .transform((v, ctx) => {
      if (v === '') return null
      const id = parseYouTubeId(v)
      if (!id) {
        ctx.addIssue({ code: 'custom', message: 'Enter the YouTube Live video id or watch URL.' })
        return z.NEVER
      }
      return id
    }),
})

export const scheduleItemSchema = z.object({
  title: z.string().trim().min(3).max(200),
  // <input type="datetime-local"> value, interpreted as Lagos time (UTC+1, no DST).
  startsAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Pick a date and time.')
    .transform((v) => new Date(`${v}:00+01:00`)),
  categoryId: optionalUuid,
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
