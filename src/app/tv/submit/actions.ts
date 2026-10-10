'use server'

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { recordAudit } from '@/lib/audit'
import { clientIp, hashIp } from '@/lib/auth'
import { submissionReference, slugSuffix } from '@/lib/ids'
import { RateLimiter } from '@/lib/rate-limit'
import { videoSlug } from '@/lib/slug'
import { fieldErrors, formToObject, submissionSchema, type FieldErrors } from '@/lib/validation'
import { parseYouTubeId } from '@/lib/youtube'

export type SubmitState =
  | { status: 'idle' }
  | { status: 'error'; message: string; errors: FieldErrors; values: Record<string, string> }
  | { status: 'success'; reference: string }

// 5 submissions per IP per hour (NFR-04 abuse control). If the host does not forward client IPs,
// fall back to a site-wide cap rather than letting one visitor block everyone.
const limiter = new RateLimiter(5, 60 * 60 * 1000)
const sharedLimiter = new RateLimiter(100, 60 * 60 * 1000)

export async function submitStory(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const values = formToObject(form)
  // Echo user input back on error, minus the consent box and honeypot.
  const echo = { ...values }
  delete echo.consent
  delete echo.website

  const parsed = submissionSchema.safeParse(values)
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error)
    // A filled honeypot means a bot: respond as if it worked, store nothing.
    if (errors.website) return { status: 'success', reference: submissionReference() }
    return { status: 'error', message: 'Please fix the highlighted fields.', errors, values: echo }
  }
  const data = parsed.data

  // Only well-formed submissions count, so people fixing typos are never locked out.
  const ip = await clientIp()
  const ipHash = hashIp(ip)
  const allowed = ip === 'unknown' ? sharedLimiter.hit('unknown') : limiter.hit(ipHash)
  if (!allowed) {
    return {
      status: 'error',
      message: 'You have sent several stories in a short time. Please wait an hour and try again.',
      errors: {},
      values: echo,
    }
  }

  const [category] = await db
    .select({ id: schema.videoCategories.id })
    .from(schema.videoCategories)
    .where(eq(schema.videoCategories.slug, data.category))
    .limit(1)
  if (!category) {
    return { status: 'error', message: 'Please fix the highlighted fields.', errors: { category: 'Choose a category.' }, values: echo }
  }

  const reference = submissionReference()
  const video = { id: randomUUID(), title: data.title }
  await db.transaction(async (tx) => {
    await tx.insert(schema.videos).values({
        id: video.id,
        slug: videoSlug(data.title, slugSuffix()),
        title: data.title,
        summary: data.description.slice(0, 400),
        description: data.description,
        categoryId: category.id,
        source: 'citizen',
        // A YouTube link can be previewed safely by staff; any other link is kept for manual review only.
        providerRef: parseYouTubeId(data.mediaUrl),
        submittedMediaUrl: data.mediaUrl,
        location: data.location,
        reporterName: data.name,
        status: 'pending',
      })
    await tx.insert(schema.submitterContacts).values({
      videoId: video.id,
      reference,
      name: data.name,
      email: data.email,
      phone: data.phone,
      ipHash,
      consentAt: new Date(),
    })
  })

  await recordAudit({ id: null, name: 'Public submission' }, 'submission.created', {
    type: 'video',
    id: video.id,
    label: video.title,
  }, `Reference ${reference}`)

  return { status: 'success', reference }
}
