import { jsonError, sameOrigin } from '@/lib/http'
import { UploadError, completeUpload } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

/** Finishes an upload: verifies the size and that the bytes really are a supported video. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return jsonError('Forbidden.', 403)
  const { id } = await ctx.params
  try {
    const result = await completeUpload(id, request.headers.get('x-upload-token'))
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof UploadError) return jsonError(e.message, e.status, e.extra)
    throw e
  }
}
