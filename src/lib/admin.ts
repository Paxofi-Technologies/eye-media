import 'server-only'
import { and, asc, count, desc, eq, gte, inArray, like, or, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/mysql-core'
import { db, schema } from '@/db'
import type { VideoStatus } from '@/db/schema'

const { videos, videoCategories: cats, users } = schema

export const QUEUE_STATUSES: VideoStatus[] = ['pending', 'flagged']

export async function getQueueCount() {
  const [row] = await db.select({ n: count() }).from(videos).where(inArray(videos.status, QUEUE_STATUSES))
  return row?.n ?? 0
}

export async function getQueue() {
  return db
    .select({
      id: videos.id,
      title: videos.title,
      status: videos.status,
      source: videos.source,
      sensitive: videos.sensitive,
      reporterName: videos.reporterName,
      provider: videos.provider,
      providerRef: videos.providerRef,
      muxPublicPlaybackId: videos.muxPublicPlaybackId,
      muxPrivatePlaybackId: videos.muxPrivatePlaybackId,
      mediaStatus: videos.mediaStatus,
      thumbnailUrl: videos.thumbnailUrl,
      createdAt: videos.createdAt,
      categoryName: cats.name,
    })
    .from(videos)
    .leftJoin(cats, eq(cats.id, videos.categoryId))
    .where(inArray(videos.status, QUEUE_STATUSES))
    // Flagged items surface first, then oldest-first so nothing waits forever.
    .orderBy(desc(eq(videos.status, 'flagged')), asc(videos.createdAt))
    .limit(100)
}

export async function getVideoForStaff(id: string) {
  const reporter = alias(users, 'reporter')
  const [row] = await db
    .select({
      video: videos,
      categoryName: cats.name,
      reporterAccountName: reporter.name,
    })
    .from(videos)
    .leftJoin(cats, eq(cats.id, videos.categoryId))
    .leftJoin(reporter, eq(reporter.id, videos.reporterId))
    .where(eq(videos.id, id))
    .limit(1)
  return row ?? null
}

export async function getModerationHistory(videoId: string) {
  return db
    .select({
      id: schema.moderationReviews.id,
      decision: schema.moderationReviews.decision,
      notes: schema.moderationReviews.notes,
      createdAt: schema.moderationReviews.createdAt,
      reviewerName: users.name,
    })
    .from(schema.moderationReviews)
    .leftJoin(users, eq(users.id, schema.moderationReviews.reviewerId))
    .where(eq(schema.moderationReviews.videoId, videoId))
    .orderBy(desc(schema.moderationReviews.createdAt))
}

/** `ownerId` limits everything to one reporter's own videos. */
export async function getVideoStats(ownerId: string | null = null) {
  const rows = await db
    .select({ status: videos.status, n: count() })
    .from(videos)
    .where(ownerId ? eq(videos.reporterId, ownerId) : undefined)
    .groupBy(videos.status)
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<VideoStatus, number>>
  return by
}

export const REGISTRY_PAGE_SIZE = 10

export async function listVideos(params: { q: string; categoryId: string | null; status: VideoStatus | null; page: number; ownerId?: string | null }) {
  const conds: SQL[] = []
  if (params.ownerId) conds.push(eq(videos.reporterId, params.ownerId))
  if (params.q) {
    const pattern = `%${params.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    conds.push(or(like(videos.title, pattern), like(videos.reporterName, pattern), like(videos.providerRef, pattern))!)
  }
  if (params.categoryId) conds.push(eq(videos.categoryId, params.categoryId))
  if (params.status) conds.push(eq(videos.status, params.status))
  const where = conds.length ? and(...conds) : undefined

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: videos.id,
        slug: videos.slug,
        title: videos.title,
        status: videos.status,
        source: videos.source,
        provider: videos.provider,
        providerRef: videos.providerRef,
        muxPublicPlaybackId: videos.muxPublicPlaybackId,
        muxPrivatePlaybackId: videos.muxPrivatePlaybackId,
        mediaStatus: videos.mediaStatus,
        thumbnailUrl: videos.thumbnailUrl,
        reporterName: videos.reporterName,
        viewCount: videos.viewCount,
        updatedAt: videos.updatedAt,
        categoryName: cats.name,
      })
      .from(videos)
      .leftJoin(cats, eq(cats.id, videos.categoryId))
      .where(where)
      .orderBy(desc(videos.updatedAt))
      .limit(REGISTRY_PAGE_SIZE)
      .offset((params.page - 1) * REGISTRY_PAGE_SIZE),
    db.select({ n: count() }).from(videos).where(where),
  ])
  return { rows, total: total?.n ?? 0 }
}

const events = schema.liveEvents

export async function getLiveCount() {
  const [row] = await db.select({ n: count() }).from(events).where(eq(events.status, 'live'))
  return row?.n ?? 0
}

/** Live now, upcoming, and the last 7 days, for the Live & Schedule console. */
export async function listLiveEventsForStaff() {
  const replayVideo = alias(videos, 'replay_video')
  return db
    .select({
      id: events.id,
      title: events.title,
      city: events.city,
      venue: events.venue,
      status: events.status,
      featured: events.featured,
      providerRef: events.providerRef,
      recordingAssetId: events.recordingAssetId,
      startsAt: events.startsAt,
      startedAt: events.startedAt,
      endedAt: events.endedAt,
      replayVideoId: events.replayVideoId,
      replayStatus: replayVideo.status,
      categoryName: cats.name,
    })
    .from(events)
    .leftJoin(cats, eq(cats.id, events.categoryId))
    .leftJoin(replayVideo, eq(replayVideo.id, events.replayVideoId))
    .where(or(eq(events.status, 'live'), gte(events.startsAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))))
    .orderBy(desc(eq(events.status, 'live')), asc(events.startsAt))
    .limit(300)
}

export async function getLiveEventForStaff(id: string) {
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1)
  return row ?? null
}

export const AUDIT_PAGE_SIZE = 10

export async function listAudit(params: { actorId: string | null; action: string | null; q: string; page: number }) {
  const conds: SQL[] = []
  if (params.actorId) conds.push(eq(schema.auditLog.actorId, params.actorId))
  if (params.action) conds.push(eq(schema.auditLog.action, params.action))
  if (params.q) {
    const pattern = `%${params.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    conds.push(or(like(schema.auditLog.targetLabel, pattern), like(schema.auditLog.notes, pattern), like(schema.auditLog.actorName, pattern))!)
  }
  const where = conds.length ? and(...conds) : undefined
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(schema.auditLog)
      .where(where)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((params.page - 1) * AUDIT_PAGE_SIZE),
    db.select({ n: count() }).from(schema.auditLog).where(where),
  ])
  return { rows, total: total?.n ?? 0 }
}

export async function listStaff() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      title: users.title,
      role: users.role,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.name))
}
