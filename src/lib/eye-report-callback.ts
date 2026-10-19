import 'server-only'
import { createHmac, randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, lt, lte } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { EyeReportEventType } from '@/db/schema'
import { backoffMs } from './eye-report-backoff'
import { siteUrl } from './site'

const MAX_ATTEMPTS = 12
const EVENT_NAMES: Record<EyeReportEventType, string> = {
  published: 'video.published',
  rejected: 'video.rejected',
  unpublished: 'video.unpublished',
}

export function callbackConfigured(): boolean {
  return Boolean(process.env.EYE_REPORT_CALLBACK_URL?.trim() && process.env.EYE_REPORT_WEBHOOK_SECRET?.trim())
}

/**
 * Records that an editor decided about a video that came from EyeReport and tries to tell EyeReport straight away.
 * Videos that did not come from EyeReport are ignored. Never throws: a failed callback must not block the editor.
 * Rejection notes are internal and are never sent.
 */
export async function queueEyeReportEvent(videoId: string, event: EyeReportEventType): Promise<void> {
  try {
    const video = await db.query.videos.findFirst({ where: eq(schema.videos.id, videoId) })
    if (!video?.externalRef || video.source !== 'eye_report') return
    const id = randomUUID()
    await db.insert(schema.eyeReportEvents).values({ id, videoId, externalRef: video.externalRef, event })
    void deliverEvent(id).catch(() => undefined)
  } catch {
    // The editor's decision stands; the outbox simply has no entry.
  }
}

async function deliverEvent(id: string): Promise<void> {
  const row = await db.query.eyeReportEvents.findFirst({ where: eq(schema.eyeReportEvents.id, id) })
  if (!row || row.deliveredAt) return
  if (!callbackConfigured()) return // stays queued until the settings are added
  const video = await db.query.videos.findFirst({ where: eq(schema.videos.id, row.videoId ?? '') })
  if (!video) {
    await db.update(schema.eyeReportEvents).set({ deliveredAt: new Date(), lastError: 'video no longer exists' }).where(eq(schema.eyeReportEvents.id, id))
    return
  }

  const body = JSON.stringify({
    event: EVENT_NAMES[row.event],
    externalId: row.externalRef,
    videoId: video.id,
    eyeTvUrl: row.event === 'published' ? `${siteUrl()}/tv/${video.slug}` : null,
    occurredAt: row.createdAt.toISOString(),
  })
  const t = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', process.env.EYE_REPORT_WEBHOOK_SECRET!.trim()).update(`${t}.${body}`).digest('hex')
  const attempts = row.attempts + 1
  try {
    const res = await fetch(process.env.EYE_REPORT_CALLBACK_URL!.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-EyeTV-Signature': `t=${t},v1=${v1}` },
      body,
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`EyeReport answered ${res.status}`)
    await db.update(schema.eyeReportEvents).set({ deliveredAt: new Date(), attempts, lastError: null }).where(eq(schema.eyeReportEvents.id, id))
  } catch (e) {
    await db
      .update(schema.eyeReportEvents)
      .set({
        attempts,
        lastError: (e instanceof Error ? e.message : 'delivery failed').slice(0, 500),
        nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
      })
      .where(eq(schema.eyeReportEvents.id, id))
  }
}

/** Retries everything that is due. Called every minute by the app itself (see src/instrumentation.ts). */
export async function processOutbox(): Promise<void> {
  if (!callbackConfigured()) return
  const due = await db
    .select({ id: schema.eyeReportEvents.id })
    .from(schema.eyeReportEvents)
    .where(
      and(
        isNull(schema.eyeReportEvents.deliveredAt),
        lte(schema.eyeReportEvents.nextAttemptAt, new Date()),
        lt(schema.eyeReportEvents.attempts, MAX_ATTEMPTS),
      ),
    )
    .orderBy(asc(schema.eyeReportEvents.createdAt))
    .limit(20)
  for (const { id } of due) await deliverEvent(id)
}
