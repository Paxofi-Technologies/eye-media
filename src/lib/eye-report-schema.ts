import { z } from 'zod'
import { SLUG_PATTERN } from './slug'

/**
 * What EyeReport sends when an approved video report is handed over to Eye TV.
 * Deliberately has no field for names, emails, phone numbers or anything else about the citizen:
 * `.strict()` rejects any extra field, so personal details can never cross over by accident.
 */
export const eyeReportPayloadSchema = z
  .object({
    /** EyeReport's own id for the report. Sending the same id again never creates a second video. */
    externalId: z.string().min(1).max(100).regex(/^[A-Za-z0-9._:-]+$/, 'Use letters, numbers and . _ : -'),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(4000).optional(),
    /** Eye TV category slug, e.g. "public-safety". Unknown or missing: an editor chooses. */
    category: z.string().trim().regex(SLUG_PATTERN).max(80).optional(),
    location: z.string().trim().max(160).optional(),
    /** A time-limited https link to the video file. Mux downloads it; Eye TV never stores it. */
    videoUrl: z
      .string()
      .trim()
      .max(2000)
      .regex(/^https:\/\/[^\s]+$/i, 'Use a full https:// link to the video file.'),
  })
  .strict()

export type EyeReportPayload = z.infer<typeof eyeReportPayloadSchema>
