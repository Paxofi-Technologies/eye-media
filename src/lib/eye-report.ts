import 'server-only'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { recordAudit } from './audit'
import { slugSuffix } from './ids'
import { MuxError, createAssetFromUrl, deleteAsset, muxReady, policyId } from './mux'
import type { EyeReportPayload } from './eye-report-schema'
import { videoSlug } from './slug'

export type ImportResult =
  | { ok: true; id: string; status: string; duplicate: boolean }
  | { ok: false; status: number; message: string }

const isDuplicateKey = (e: unknown) => {
  const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code
  return code === 'ER_DUP_ENTRY'
}

/** Creates a pending Eye TV video (private on Mux) from an approved EyeReport report. Safe to repeat. */
export async function importEyeReportVideo(p: EyeReportPayload): Promise<ImportResult> {
  const existing = await db.query.videos.findFirst({ where: eq(schema.videos.externalRef, p.externalId) })
  if (existing) return { ok: true, id: existing.id, status: existing.status, duplicate: true }
  if (!muxReady()) return { ok: false, status: 503, message: 'Video hosting is not configured on Eye TV.' }

  const id = randomUUID()
  let asset
  try {
    asset = await createAssetFromUrl({ url: p.videoUrl, passthrough: id })
  } catch (e) {
    // 5xx so EyeReport retries later; 4xx from Mux means the link or file was rejected.
    const rejected = e instanceof MuxError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403 && e.status !== 429
    return { ok: false, status: rejected ? 422 : 502, message: e instanceof Error ? e.message : 'Could not start the video import.' }
  }

  const category = p.category
    ? (await db.select({ id: schema.videoCategories.id }).from(schema.videoCategories).where(eq(schema.videoCategories.slug, p.category)).limit(1))[0]
    : undefined

  try {
    await db.insert(schema.videos).values({
      id,
      slug: videoSlug(p.title, slugSuffix()),
      title: p.title,
      summary: p.description?.slice(0, 400) ?? null,
      description: p.description ?? null,
      categoryId: category?.id ?? null,
      source: 'eye_report',
      provider: 'mux',
      providerRef: null,
      muxAssetId: asset.id,
      muxPrivatePlaybackId: policyId(asset.playback_ids, 'signed'),
      mediaStatus: 'processing',
      location: p.location ?? null,
      reporterName: 'EyeReport',
      status: 'pending',
      externalRef: p.externalId,
    })
  } catch (e) {
    await deleteAsset(asset.id).catch(() => undefined)
    if (isDuplicateKey(e)) {
      const again = await db.query.videos.findFirst({ where: eq(schema.videos.externalRef, p.externalId) })
      if (again) return { ok: true, id: again.id, status: again.status, duplicate: true }
    }
    throw e
  }

  await recordAudit({ id: null, name: 'EyeReport integration' }, 'video.imported', { type: 'video', id, label: p.title }, `EyeReport ${p.externalId}`)
  return { ok: true, id, status: 'pending', duplicate: false }
}
