import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { getUploadMeta, uploadPath } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })

/**
 * Streams an uploaded video with HTTP Range support (needed for seeking and for iOS Safari).
 * Public only once the video it belongs to is published; until then, staff only.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const meta = await getUploadMeta(id)
  if (!meta || meta.status === 'uploading') return notFound()

  const [published] = await db
    .select({ id: schema.videos.id })
    .from(schema.videos)
    .where(and(eq(schema.videos.provider, 'upload'), eq(schema.videos.providerRef, id), eq(schema.videos.status, 'published')))
    .limit(1)
  if (!published) {
    const user = await getCurrentUser()
    if (!user || !(can(user.role, 'video.view') || can(user.role, 'queue.view'))) return notFound()
  }

  let size: number
  try {
    size = (await stat(uploadPath(id))).size
  } catch {
    return notFound()
  }

  const headers = new Headers({
    'Content-Type': meta.mimeType,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': 'inline',
    // Published media may be cached by browsers/Cloudflare; unpublished media never.
    'Cache-Control': published ? 'public, max-age=3600' : 'private, no-store',
  })

  const range = request.headers.get('range')
  const match = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (range && !match) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  if (match) {
    let start: number
    let end: number
    if (match[1] === '' && match[2] !== '') {
      // Suffix range: last N bytes.
      start = Math.max(0, size - Number(match[2]))
      end = size - 1
    } else {
      start = Number(match[1])
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
    }
    if (!Number.isFinite(start) || start >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    headers.set('Content-Length', String(end - start + 1))
    const stream = Readable.toWeb(createReadStream(uploadPath(id), { start, end })) as ReadableStream
    return new Response(stream, { status: 206, headers })
  }

  headers.set('Content-Length', String(size))
  const stream = Readable.toWeb(createReadStream(uploadPath(id))) as ReadableStream
  return new Response(stream, { status: 200, headers })
}
