import 'server-only'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, open, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { MediaUpload } from '@/db/schema'
import { MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES, sniffVideoType } from './media'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const STALE_MS = 24 * 60 * 60 * 1000

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

/**
 * Where uploaded videos are stored. Must be outside the deployed app folder so a new release
 * never deletes them. Required in production; defaults to ./.media in development.
 */
export function mediaDir(): string | null {
  const dir = process.env.MEDIA_DIR?.trim()
  if (dir) return path.resolve(dir)
  return process.env.NODE_ENV === 'production' ? null : path.resolve(process.cwd(), '.media')
}

export function uploadsEnabled(): boolean {
  return mediaDir() !== null
}

/** Absolute file path for an upload id. The id is validated, so it can never escape MEDIA_DIR. */
export function uploadPath(id: string): string {
  const dir = mediaDir()
  if (!dir) throw new UploadError('Video uploads are not configured on this server.', 503)
  if (!UUID.test(id)) throw new UploadError('Invalid upload.', 400)
  return path.join(dir, 'videos', id)
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

function tokenMatches(row: Pick<MediaUpload, 'tokenHash'>, token: string | null): boolean {
  if (!token || token.length > 100) return false
  const a = Buffer.from(sha256(token), 'hex')
  const b = Buffer.from(row.tokenHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

async function findUpload(id: string, token: string | null): Promise<MediaUpload> {
  if (!UUID.test(id)) throw new UploadError('Invalid upload.', 404)
  const row = await db.query.mediaUploads.findFirst({ where: eq(schema.mediaUploads.id, id) })
  // Same answer for "missing" and "wrong token" so ids can't be probed.
  if (!row || !tokenMatches(row, token)) throw new UploadError('Upload not found.', 404)
  return row
}

/** Removes uploads that were never finished or never attached to a video within 24 hours. */
export async function cleanupStaleUploads(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_MS)
  const stale = await db
    .select({ id: schema.mediaUploads.id })
    .from(schema.mediaUploads)
    .where(and(inArray(schema.mediaUploads.status, ['uploading', 'complete']), lt(schema.mediaUploads.createdAt, cutoff)))
    .limit(200)
  for (const { id } of stale) {
    await rm(uploadPath(id), { force: true }).catch(() => undefined)
    await db.delete(schema.mediaUploads).where(eq(schema.mediaUploads.id, id))
  }
}

export async function createUpload(input: {
  purpose: 'citizen' | 'staff'
  name: string
  size: number
  userId: string | null
  ipHash: string | null
}): Promise<{ id: string; token: string; chunkSize: number }> {
  const dir = mediaDir()
  if (!dir) throw new UploadError('Video uploads are not configured on this server yet.', 503)
  if (!Number.isSafeInteger(input.size) || input.size <= 0) throw new UploadError('Empty file.', 400)
  if (input.size > MAX_UPLOAD_BYTES) throw new UploadError('This video is larger than 500MB.', 413)

  await cleanupStaleUploads()
  const id = randomUUID()
  const token = randomBytes(32).toString('base64url')
  await mkdir(path.join(dir, 'videos'), { recursive: true })
  // Create the empty file first so every chunk can be written at its offset.
  const fh = await open(uploadPath(id), 'wx', 0o640)
  await fh.close()
  await db.insert(schema.mediaUploads).values({
    id,
    purpose: input.purpose,
    tokenHash: sha256(token),
    originalName: input.name.replace(/[^\w.\- ()]/g, '_').slice(0, 200) || 'video',
    mimeType: 'application/octet-stream',
    sizeBytes: input.size,
    uploadedBy: input.userId,
    ipHash: input.ipHash,
  })
  return { id, token, chunkSize: UPLOAD_CHUNK_BYTES }
}

/** Writes one chunk. Chunks must arrive in order; a retried chunk at an old offset is rejected with the expected offset. */
export async function appendChunk(id: string, token: string | null, offset: number, data: Uint8Array): Promise<number> {
  const row = await findUpload(id, token)
  if (row.status !== 'uploading') throw new UploadError('This upload is already finished.', 409)
  if (offset !== row.receivedBytes) {
    throw new UploadError('Unexpected chunk offset.', 409, { expectedOffset: row.receivedBytes })
  }
  if (data.byteLength === 0 || data.byteLength > UPLOAD_CHUNK_BYTES) throw new UploadError('Invalid chunk size.', 400)
  if (offset + data.byteLength > row.sizeBytes) throw new UploadError('More data than the declared file size.', 400)

  const fh = await open(uploadPath(id), 'r+')
  try {
    await fh.write(data, 0, data.byteLength, offset)
  } finally {
    await fh.close()
  }
  // Guarded update: if two requests raced for the same offset, only one is counted.
  const [res] = await db
    .update(schema.mediaUploads)
    .set({ receivedBytes: sql`${schema.mediaUploads.receivedBytes} + ${data.byteLength}` })
    .where(and(eq(schema.mediaUploads.id, id), eq(schema.mediaUploads.receivedBytes, offset)))
  if (res.affectedRows === 0) throw new UploadError('Chunk was sent twice.', 409)
  return offset + data.byteLength
}

/** Checks the size and the real file type, then marks the upload ready to attach. */
export async function completeUpload(id: string, token: string | null): Promise<{ mimeType: string }> {
  const row = await findUpload(id, token)
  if (row.status !== 'uploading') return { mimeType: row.mimeType }
  const file = uploadPath(id)
  const info = await stat(file)
  if (row.receivedBytes !== row.sizeBytes || info.size !== row.sizeBytes) {
    throw new UploadError('The upload is incomplete.', 409, { expectedOffset: row.receivedBytes })
  }
  const fh = await open(file, 'r')
  const head = new Uint8Array(64)
  try {
    await fh.read(head, 0, 64, 0)
  } finally {
    await fh.close()
  }
  const mimeType = sniffVideoType(head)
  if (!mimeType) {
    await rm(file, { force: true })
    await db.delete(schema.mediaUploads).where(eq(schema.mediaUploads.id, id))
    throw new UploadError('This file is not a supported video (MP4, MOV or WebM).', 415)
  }
  await db
    .update(schema.mediaUploads)
    .set({ status: 'complete', mimeType, completedAt: new Date() })
    .where(eq(schema.mediaUploads.id, id))
  return { mimeType }
}

/**
 * Validates an upload referenced by a form and marks it attached. Returns null if the upload is
 * missing, unfinished, already used, belongs to another purpose, or the token is wrong.
 */
export async function claimUpload(
  id: string | null | undefined,
  token: string | null | undefined,
  purpose: 'citizen' | 'staff',
): Promise<MediaUpload | null> {
  if (!id || !token) return null
  let row: MediaUpload
  try {
    row = await findUpload(id, token)
  } catch {
    return null
  }
  if (row.status !== 'complete' || row.purpose !== purpose) return null
  const [res] = await db
    .update(schema.mediaUploads)
    .set({ status: 'attached' })
    .where(and(eq(schema.mediaUploads.id, id), eq(schema.mediaUploads.status, 'complete')))
  return res.affectedRows === 1 ? row : null
}

export async function getUploadMeta(id: string) {
  if (!UUID.test(id)) return null
  return (await db.query.mediaUploads.findFirst({ where: eq(schema.mediaUploads.id, id) })) ?? null
}
