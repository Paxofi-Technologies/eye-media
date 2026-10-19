import { z } from 'zod'
import { clientIp, getCurrentUser, hashIp } from '@/lib/auth'
import { jsonError, sameOrigin } from '@/lib/http'
import { can } from '@/lib/rbac'
import { UploadError, createUpload } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  name: z.string().min(1).max(500),
  size: z.number().int().positive(),
})

/** Starts a direct upload to Mux (staff only). Returns our upload id, a secret token for this upload, and Mux's upload URL. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError('Forbidden.', 403)
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError('Invalid request.', 400)
  const { name, size } = parsed.data

  // Only signed-in staff and reporters can upload; there is no public upload.
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'video.edit')) return jsonError('Not authorised.', 403)
  const ipHash = hashIp(await clientIp())

  try {
    const upload = await createUpload({ name, size, userId: user.id, ipHash })
    return Response.json(upload, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof UploadError) return jsonError(e.message, e.status, e.extra)
    throw e
  }
}
