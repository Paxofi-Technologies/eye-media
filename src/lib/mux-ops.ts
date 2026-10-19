import 'server-only'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { LiveEvent } from '@/db/schema'
import type { MuxMediaFields } from './uploads'
import {
  MuxError,
  addAssetPlaybackId,
  addLivePlaybackId,
  completeLiveStream,
  createAssetFromUrl,
  createLiveStream,
  deleteAsset,
  deleteLiveStream,
  getAsset,
  getLiveStream,
  muxReady,
  policyId,
  removeAssetPlaybackId,
  removeLivePlaybackId,
} from './mux'

const isNotFound = (e: unknown) => e instanceof MuxError && e.status === 404
const message = (e: unknown) => (e instanceof Error ? e.message : 'Unknown error.')

/* ------------------------------------------------------------------ */
/* Videos: private until published                                      */
/* ------------------------------------------------------------------ */

/** Publishing adds a public playback id (reusing one if a previous attempt already created it). */
export async function ensurePublicAssetId(assetId: string): Promise<string> {
  const asset = await getAsset(assetId)
  const existing = policyId(asset.playback_ids, 'public')
  if (existing) return existing
  return (await addAssetPlaybackId(assetId, 'public')).id
}

/** Unpublishing removes the public playback id, so the old link stops working immediately. */
export async function removePublicAssetId(assetId: string, publicId: string): Promise<void> {
  try {
    await removeAssetPlaybackId(assetId, publicId)
  } catch (e) {
    if (!isNotFound(e)) throw e
  }
}

/** Asks Mux to download a video from a direct https link (staff "paste a link"). The asset is private until published. */
export async function importVideoFromUrl(url: string): Promise<MuxMediaFields> {
  const asset = await createAssetFromUrl({ url, passthrough: randomUUID() })
  return {
    provider: 'mux',
    providerRef: null,
    muxAssetId: asset.id,
    muxPrivatePlaybackId: policyId(asset.playback_ids, 'signed'),
    mediaStatus: 'processing',
    durationSeconds: null,
  }
}

export async function deleteAssetQuietly(assetId: string | null | undefined): Promise<void> {
  if (!assetId || !muxReady()) return
  try {
    await deleteAsset(assetId)
  } catch {
    // A leftover asset only costs storage; never block the editor on it.
  }
}

/* ------------------------------------------------------------------ */
/* Live events                                                          */
/* ------------------------------------------------------------------ */

/** Creates the Mux live stream for an event (private until the event goes live). */
export async function createStreamForEvent(eventId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!muxReady()) return { ok: false, message: 'Mux is not connected yet. Add the Mux access token and signing key, then create the stream.' }
  const event = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.id, eventId) })
  if (!event) return { ok: false, message: 'This event no longer exists.' }
  if (event.muxLiveStreamId) return { ok: true }
  try {
    const stream = await createLiveStream(eventId)
    await db
      .update(schema.liveEvents)
      .set({
        provider: 'mux',
        muxLiveStreamId: stream.id,
        muxPrivatePlaybackId: policyId(stream.playback_ids, 'signed'),
        updatedAt: new Date(),
      })
      .where(eq(schema.liveEvents.id, eventId))
    return { ok: true }
  } catch (e) {
    return { ok: false, message: `Could not create the Mux stream. ${message(e)}` }
  }
}

export type EventTarget = 'live' | 'ended' | 'cancelled' | 'scheduled'
export type TransitionResult = { ok: true; warning?: string; changed: boolean } | { ok: false; message: string }

/**
 * The one place that changes a live event's state. Used by the admin buttons and by Mux webhooks.
 *  - going live adds the stream's public playback id (viewers can only watch while it exists);
 *  - ending, cancelling or rescheduling removes it again;
 *  - an editor pressing "End" also tells Mux the stream is finished so the recording is finalised.
 */
export async function transitionEvent(
  eventId: string,
  to: EventTarget,
  source: 'staff' | 'mux',
): Promise<TransitionResult> {
  const event = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.id, eventId) })
  if (!event) return { ok: false, message: 'This event no longer exists.' }
  if (event.status === to) return { ok: true, changed: false }
  const now = new Date()
  const isMux = Boolean(event.muxLiveStreamId)

  if (to === 'live') {
    let publicId = event.muxPublicPlaybackId
    if (isMux) {
      try {
        if (!publicId) {
          const stream = await getLiveStream(event.muxLiveStreamId!)
          publicId = policyId(stream.playback_ids, 'public') ?? (await addLivePlaybackId(event.muxLiveStreamId!, 'public')).id
        }
      } catch (e) {
        return { ok: false, message: `Could not put the stream on air. ${message(e)}` }
      }
    } else if (!event.providerRef) {
      return { ok: false, message: 'Create the Mux stream for this event before going live.' }
    }
    await db
      .update(schema.liveEvents)
      .set({ status: 'live', startedAt: event.startedAt ?? now, endedAt: null, muxPublicPlaybackId: publicId, updatedAt: now })
      .where(eq(schema.liveEvents.id, eventId))
    return { ok: true, changed: true }
  }

  // Everything else takes the event off air.
  let warning: string | undefined
  let remainingPublicId = event.muxPublicPlaybackId
  if (isMux && event.muxPublicPlaybackId) {
    try {
      await removeLivePlaybackId(event.muxLiveStreamId!, event.muxPublicPlaybackId)
      remainingPublicId = null
    } catch (e) {
      if (isNotFound(e)) remainingPublicId = null
      else warning = `The event is off air on Eye TV, but Mux could not remove public access (${message(e)}). Press the button again to retry.`
    }
  }
  if (to === 'ended' && source === 'staff' && event.status === 'live' && isMux) {
    await completeLiveStream(event.muxLiveStreamId!).catch(() => undefined)
  }
  await db
    .update(schema.liveEvents)
    .set({
      status: to,
      endedAt: to === 'ended' ? now : event.endedAt,
      muxPublicPlaybackId: remainingPublicId,
      updatedAt: now,
    })
    .where(eq(schema.liveEvents.id, eventId))
  return { ok: true, changed: true, warning }
}

/** Deletes the Mux stream of an event that never aired. */
export async function deleteStreamQuietly(event: Pick<LiveEvent, 'muxLiveStreamId'>): Promise<void> {
  if (!event.muxLiveStreamId || !muxReady()) return
  try {
    await deleteLiveStream(event.muxLiveStreamId)
  } catch {
    // Orphaned idle streams cost nothing.
  }
}
