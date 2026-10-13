import 'server-only'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import { and, eq, inArray, lt } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { MediaUpload } from '@/db/schema'
import { MAX_UPLOAD_BYTES } from './media'
import {
  MuxError,
  cancelDirectUpload,
  createDirectUpload,
  deleteAsset,
  getAsset,
  getDirectUpload,
  muxReady,
  policyId,
} from './mux'
import { siteUrl } from './site'

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

export function uploadsEnabled(): boolean {
  return muxReady()
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

function tokenMatches(row: Pick<MediaUpload, 'tokenHash'>, token: string | null): boolean {
  if (!token || token.length > 100) return false
  const a = Buffer.from(sha256(token), 'hex')
  const b = Buffer.from(row.tokenHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

async function findUpload(id: string, token: string | null): Promise<MediaUpload> {
  if (!UUID.test(id)) throw new UploadError('Upload not found.', 404)
  const row = await db.query.mediaUploads.findFirst({ where: eq(schema.mediaUploads.id, id) })
  // Same answer for "missing" and "wrong token" so ids can't be probed.
  if (!row || !tokenMatches(row, token)) throw new UploadError('Upload not found.', 404)
  return row
}

function asUploadError(e: unknown): never {
  if (e instanceof UploadError) throw e
  if (e instanceof MuxError) throw new UploadError(e.status >= 500 || e.status === 502 ? 'The video service is not responding. Please try again in a moment.' : e.message, e.status === 502 ? 502 : 503)
  throw e
}

/**
 * Removes uploads that were never finished or never attached to a story within 24 hours, including the
 * video Mux already holds for them, so abandoned uploads don't accumulate storage costs.
 */
export async function cleanupStaleUploads(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_MS)
  const rows = await db
    .select()
    .from(schema.mediaUploads)
    .where(and(inArray(schema.mediaUploads.status, ['uploading', 'complete']), lt(schema.mediaUploads.createdAt, cutoff)))
    .limit(50)
  for (const row of rows) {
    try {
      let assetId = row.muxAssetId
      if (!assetId && row.muxUploadId) assetId = (await getDirectUpload(row.muxUploadId).catch(() => null))?.asset_id ?? null
      if (assetId) await deleteAsset(assetId).catch((e) => ignoreNotFound(e))
      else if (row.muxUploadId) await cancelDirectUpload(row.muxUploadId).catch((e) => ignoreNotFound(e))
    } catch {
      continue // Mux unreachable: try again on the next cleanup
    }
    await db.delete(schema.mediaUploads).where(eq(schema.mediaUploads.id, row.id))
  }
}

function ignoreNotFound(e: unknown) {
  if (!(e instanceof MuxError) || (e.status !== 404 && e.status !== 400)) throw e
}

/** Starts a direct upload to Mux. The browser sends the file to the returned URL, not to this server. */
export async function createUpload(input: {
  purpose: 'citizen' | 'staff'
  name: string
  size: number
  userId: string | null
  ipHash: string | null
}): Promise<{ id: string; token: string; url: string }> {
  if (!muxReady()) throw new UploadError('Video upload is not set up on this server yet.', 503)
  if (!Number.isSafeInteger(input.size) || input.size <= 0) throw new UploadError('Empty file.', 400)
  if (input.size > MAX_UPLOAD_BYTES) throw new UploadError('This video is larger than 500MB.', 413)

  void cleanupStaleUploads().catch(() => undefined)
  const id = randomUUID()
  const token = randomBytes(32).toString('base64url')
  try {
    const mux = await createDirectUpload({ corsOrigin: new URL(siteUrl()).origin, passthrough: id })
    await db.insert(schema.mediaUploads).values({
      id,
      purpose: input.purpose,
      tokenHash: sha256(token),
      muxUploadId: mux.id,
      originalName: input.name.replace(/[^\w.\- ()]/g, '_').slice(0, 200) || 'video',
      mimeType: 'application/octet-stream',
      sizeBytes: input.size,
      uploadedBy: input.userId,
      ipHash: input.ipHash,
    })
    return { id, token, url: mux.url }
  } catch (e) {
    return asUploadError(e)
  }
}

/**
 * Called by the browser once Mux has received the whole file. Mux creates the video asset a moment
 * later, so `ready` is false until it exists and the browser asks again.
 */
export async function completeUpload(id: string, token: string | null): Promise<{ ready: boolean }> {
  const row = await findUpload(id, token)
  if (row.status !== 'uploading') return { ready: true }
  if (!row.muxUploadId) throw new UploadError('Upload not found.', 404)
  try {
    const upload = await getDirectUpload(row.muxUploadId)
    if (upload.status === 'errored' || upload.status === 'cancelled' || upload.status === 'timed_out') {
      throw new UploadError('The upload failed on the video service. Please upload the file again.', 422)
    }
    if (upload.status !== 'asset_created' || !upload.asset_id) return { ready: false }
    await db
      .update(schema.mediaUploads)
      .set({ status: 'complete', muxAssetId: upload.asset_id, completedAt: new Date() })
      .where(eq(schema.mediaUploads.id, id))
    return { ready: true }
  } catch (e) {
    return asUploadError(e)
  }
}

/** The media fields to store on a video row for a freshly attached upload. */
export type MuxMediaFields = {
  provider: 'mux'
  providerRef: null
  muxAssetId: string
  muxPrivatePlaybackId: string | null
  mediaStatus: 'ready' | 'processing' | 'errored'
  durationSeconds: number | null
}

export async function muxFieldsForAsset(assetId: string): Promise<MuxMediaFields> {
  try {
    const asset = await getAsset(assetId)
    return {
      provider: 'mux',
      providerRef: null,
      muxAssetId: assetId,
      muxPrivatePlaybackId: policyId(asset.playback_ids, 'signed'),
      mediaStatus: asset.status === 'ready' ? 'ready' : asset.status === 'errored' ? 'errored' : 'processing',
      durationSeconds: asset.duration ? Math.round(asset.duration) : null,
    }
  } catch {
    // Mux hiccup: the webhook (or a later refresh) fills in the rest.
    return { provider: 'mux', providerRef: null, muxAssetId: assetId, muxPrivatePlaybackId: null, mediaStatus: 'processing', durationSeconds: null }
  }
}

/**
 * Validates an upload referenced by a form and marks it attached. Returns null if the upload is missing,
 * unfinished, already used, belongs to another purpose, or the token is wrong.
 */
export async function claimUpload(
  id: string | null | undefined,
  token: string | null | undefined,
  purpose: 'citizen' | 'staff',
): Promise<(MediaUpload & { muxAssetId: string }) | null> {
  if (!id || !token) return null
  let row: MediaUpload
  try {
    row = await findUpload(id, token)
  } catch {
    return null
  }
  if (row.status !== 'complete' || row.purpose !== purpose || !row.muxAssetId) return null
  const [res] = await db
    .update(schema.mediaUploads)
    .set({ status: 'attached' })
    .where(and(eq(schema.mediaUploads.id, id), eq(schema.mediaUploads.status, 'complete')))
  return res.affectedRows === 1 ? (row as MediaUpload & { muxAssetId: string }) : null
}

/* ------------------------------------------------------------------ */
/* Legacy: files uploaded to the server before Mux. Read-only; remove once none are left.        */
/* ------------------------------------------------------------------ */

export function legacyUploadPath(id: string): string | null {
  const dir = process.env.MEDIA_DIR?.trim()
  if (!dir || !UUID.test(id)) return null
  return path.join(path.resolve(dir), 'videos', id)
}

export async function getLegacyUploadMeta(id: string) {
  if (!UUID.test(id)) return null
  const row = await db.query.mediaUploads.findFirst({ where: eq(schema.mediaUploads.id, id) })
  return row && !row.muxUploadId ? row : null
}
