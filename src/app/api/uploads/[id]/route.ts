import { jsonError, sameOrigin } from '@/lib/http'
import { UPLOAD_CHUNK_BYTES } from '@/lib/media'
import { UploadError, appendChunk } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

/** Receives one chunk: raw bytes in the body, its position in `?offset=`, the upload token in a header. */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return jsonError('Forbidden.', 403)
  const { id } = await ctx.params
  const offset = Number(new URL(request.url).searchParams.get('offset'))
  if (!Number.isSafeInteger(offset) || offset < 0) return jsonError('Invalid offset.', 400)
  // Refuse oversized bodies before reading them.
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > UPLOAD_CHUNK_BYTES) return jsonError('Chunk too large.', 413)

  const data = new Uint8Array(await request.arrayBuffer())
  try {
    const received = await appendChunk(id, request.headers.get('x-upload-token'), offset, data)
    return Response.json({ received }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof UploadError) return jsonError(e.message, e.status, e.extra)
    throw e
  }
}
