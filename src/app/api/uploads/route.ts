import { z } from 'zod'
import { clientIp, getCurrentUser, hashIp } from '@/lib/auth'
import { jsonError, sameOrigin } from '@/lib/http'
import { RateLimiter } from '@/lib/rate-limit'
import { can } from '@/lib/rbac'
import { UploadError, createUpload } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

// Citizens: 10 new uploads per IP per hour (each up to 500MB).
const citizenLimiter = new RateLimiter(10, 60 * 60 * 1000)
const sharedLimiter = new RateLimiter(200, 60 * 60 * 1000)

const bodySchema = z.object({
  purpose: z.enum(['citizen', 'staff']),
  name: z.string().min(1).max(500),
  size: z.number().int().positive(),
})

/** Starts a chunked upload. Returns the id, a one-time token for the chunks, and the chunk size. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError('Forbidden.', 403)
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('Invalid request.', 400)
  const { purpose, name, size } = parsed.data

  let userId: string | null = null
  if (purpose === 'staff') {
    const user = await getCurrentUser()
    if (!user || !can(user.role, 'video.edit')) return jsonError('Not authorised.', 403)
    userId = user.id
  }
  const ip = await clientIp()
  const ipHash = hashIp(ip)
  if (purpose === 'citizen' && !(ip === 'unknown' ? sharedLimiter.hit('unknown') : citizenLimiter.hit(ipHash))) {
    return jsonError('Too many uploads from your connection. Please try again in an hour.', 429)
  }

  try {
    const upload = await createUpload({ purpose, name, size, userId, ipHash })
    return Response.json(upload, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof UploadError) return jsonError(e.message, e.status, e.extra)
    throw e
  }
}
