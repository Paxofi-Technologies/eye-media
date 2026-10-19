import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getAsset, policyId } from './mux'
import { transitionEvent } from './mux-ops'

type MuxEvent = {
  id: string
  type: string
  data?: {
    id?: string
    status?: string
    duration?: number
    live_stream_id?: string
    playback_ids?: { id: string; policy: 'public' | 'signed' | 'drm' }[]
    passthrough?: string
    errors?: unknown
  }
  object?: { id?: string; type?: string }
}

/** Brings a video row in step with its Mux asset (processing → ready / errored). */
export async function syncAsset(assetId: string): Promise<void> {
  const asset = await getAsset(assetId)
  const status = asset.status === 'ready' ? 'ready' : asset.status === 'errored' ? 'errored' : 'processing'
  const rows = await db.select().from(schema.videos).where(eq(schema.videos.muxAssetId, assetId)).limit(1)
  const video = rows[0]
  if (!video) return
  await db
    .update(schema.videos)
    .set({
      mediaStatus: status,
      durationSeconds: video.durationSeconds ?? (asset.duration ? Math.round(asset.duration) : null),
      muxPrivatePlaybackId: video.muxPrivatePlaybackId ?? policyId(asset.playback_ids, 'signed'),
      updatedAt: new Date(),
    })
    .where(eq(schema.videos.id, video.id))
}

/** Processes one verified Mux webhook. Throws on temporary failures so Mux retries. */
export async function handleMuxEvent(event: MuxEvent): Promise<void> {
  const objectId = event.data?.id ?? event.object?.id ?? ''
  switch (event.type) {
    case 'video.asset.ready':
    case 'video.asset.errored':
    case 'video.asset.updated':
    case 'video.asset.created':
      if (objectId) await syncAsset(objectId)
      return

    case 'video.asset.deleted':
      if (objectId) {
        await db
          .update(schema.videos)
          .set({ mediaStatus: 'errored', updatedAt: new Date() })
          .where(and(eq(schema.videos.muxAssetId, objectId), eq(schema.videos.status, 'draft')))
      }
      return

    // The recording of a finished broadcast; kept private until an editor turns it into a replay.
    case 'video.asset.live_stream_completed': {
      const streamId = event.data?.live_stream_id
      if (objectId && streamId) {
        await db
          .update(schema.liveEvents)
          .set({ recordingAssetId: objectId, updatedAt: new Date() })
          .where(eq(schema.liveEvents.muxLiveStreamId, streamId))
      }
      return
    }

    // The encoder started sending. Events go on air by editor action unless "go live automatically" is on.
    case 'video.live_stream.active': {
      if (!objectId) return
      const row = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.muxLiveStreamId, objectId) })
      if (row?.autoLive && row.status === 'scheduled') await transitionEvent(row.id, 'live', 'mux')
      return
    }

    // The encoder stopped and the reconnect window passed: the broadcast is over.
    case 'video.live_stream.idle': {
      if (!objectId) return
      const row = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.muxLiveStreamId, objectId) })
      if (row?.status === 'live') await transitionEvent(row.id, 'ended', 'mux')
      return
    }

    default:
      return
  }
}
