import { revalidatePath } from 'next/cache'
import { jsonError } from '@/lib/http'
import { importEyeReportVideo } from '@/lib/eye-report'
import { eyeReportPayloadSchema } from '@/lib/eye-report-schema'
import { verifyWebhookSignature } from '@/lib/mux-security'
import { RateLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// A partner API: a few hundred hand-overs an hour is plenty, and anything more is a bug or abuse.
const limiter = new RateLimiter(300, 60 * 60 * 1000)

/**
 * EyeReport → Eye TV hand-off. Authenticated with a shared secret: the header
 * `X-EyeReport-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">` (same scheme as Mux webhooks).
 */
export async function POST(req: Request) {
  const secret = process.env.EYE_REPORT_WEBHOOK_SECRET?.trim()
  if (!secret) return jsonError('The EyeReport hand-off is not configured on Eye TV.', 503)

  const raw = await req.text()
  if (raw.length > 100_000) return jsonError('Request too large.', 413)
  const check = verifyWebhookSignature(raw, req.headers.get('x-eyereport-signature'), secret)
  if (!check.ok) return jsonError('Invalid signature.', 401)
  if (!limiter.hit('eye-report')) return jsonError('Too many requests. Try again later.', 429)

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonError('Body must be JSON.', 400)
  }
  const parsed = eyeReportPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Invalid payload.', 400, {
      issues: parsed.error.issues.map((i) => ({ field: i.path.join('.') || '(body)', message: i.message })),
    })
  }

  const result = await importEyeReportVideo(parsed.data)
  if (!result.ok) return jsonError(result.message, result.status)
  if (!result.duplicate) revalidatePath('/admin', 'layout')
  return Response.json(
    { id: result.id, status: result.status, duplicate: result.duplicate },
    { status: result.duplicate ? 200 : 201, headers: { 'Cache-Control': 'no-store' } },
  )
}
