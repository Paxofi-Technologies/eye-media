import 'server-only'
import { and, asc, count, desc, eq, gte, inArray, isNotNull, like, lt, ne, notInArray, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/mysql-core'
import { db, schema } from '@/db'

const { videos, videoCategories: cats } = schema

// Only columns that are safe to show the public. Never select submitter/moderation data here.
const cardColumns = {
  id: videos.id,
  slug: videos.slug,
  title: videos.title,
  summary: videos.summary,
  provider: videos.provider,
  providerRef: videos.providerRef,
  // Public playback id only: the private id must never be selected by a public query.
  muxPublicPlaybackId: videos.muxPublicPlaybackId,
  mediaStatus: videos.mediaStatus,
  thumbnailUrl: videos.thumbnailUrl,
  durationSeconds: videos.durationSeconds,
  reporterName: videos.reporterName,
  verified: videos.verified,
  publishedAt: videos.publishedAt,
  categoryName: cats.name,
  categorySlug: cats.slug,
}

export type VideoCard = {
  id: string
  slug: string
  title: string
  summary: string | null
  provider: 'youtube' | 'upload' | 'mux'
  providerRef: string | null
  muxPublicPlaybackId: string | null
  mediaStatus: 'ready' | 'processing' | 'errored'
  thumbnailUrl: string | null
  durationSeconds: number | null
  reporterName: string | null
  verified: boolean
  publishedAt: Date | null
  categoryName: string | null
  categorySlug: string | null
}

const isPublished = eq(videos.status, 'published')

function cardQuery() {
  return db.select(cardColumns).from(videos).leftJoin(cats, eq(cats.id, videos.categoryId))
}

export async function getCategoriesWithCounts() {
  return db
    .select({
      id: cats.id,
      slug: cats.slug,
      name: cats.name,
      count: sql<number>`coalesce(sum(case when ${videos.status} = 'published' then 1 else 0 end), 0)`.mapWith(Number),
    })
    .from(cats)
    .leftJoin(videos, eq(videos.categoryId, cats.id))
    .groupBy(cats.id)
    .orderBy(asc(cats.sortOrder), asc(cats.name))
}

export async function getCategories() {
  return db.select().from(cats).orderBy(asc(cats.sortOrder), asc(cats.name))
}

export async function getFeatured(): Promise<VideoCard | null> {
  const rows = await cardQuery()
    .where(and(isPublished, eq(videos.featured, true)))
    .orderBy(desc(videos.publishedAt))
    .limit(1)
  return rows[0] ?? null
}

export async function getLatest(limit: number, excludeId?: string): Promise<VideoCard[]> {
  return cardQuery()
    .where(excludeId ? and(isPublished, ne(videos.id, excludeId)) : isPublished)
    .orderBy(desc(videos.publishedAt))
    .limit(limit)
}

export async function getEditorsPicks(limit: number): Promise<VideoCard[]> {
  return cardQuery()
    .where(and(isPublished, eq(videos.editorsPick, true)))
    .orderBy(desc(videos.publishedAt))
    .limit(limit)
}

export async function getPublishedVideo(slug: string) {
  const rows = await db
    .select({
      ...cardColumns,
      description: videos.description,
      location: videos.location,
      tags: videos.tags,
      viewCount: videos.viewCount,
      categoryId: videos.categoryId,
      reporterTitle: schema.users.title,
    })
    .from(videos)
    .leftJoin(cats, eq(cats.id, videos.categoryId))
    .leftJoin(schema.users, eq(schema.users.id, videos.reporterId))
    .where(and(isPublished, eq(videos.slug, slug)))
    .limit(1)
  return rows[0] ?? null
}

export async function recordView(id: string) {
  await db
    .update(videos)
    .set({ viewCount: sql`${videos.viewCount} + 1` })
    .where(eq(videos.id, id))
}

export async function getRelated(video: { id: string; categoryId: string | null }, limit: number) {
  const sameCategory = video.categoryId
    ? await cardQuery()
        .where(and(isPublished, ne(videos.id, video.id), eq(videos.categoryId, video.categoryId)))
        .orderBy(desc(videos.publishedAt))
        .limit(limit)
    : []
  if (sameCategory.length >= limit) return sameCategory
  const fill = await cardQuery()
    .where(
      and(
        isPublished,
        ne(videos.id, video.id),
        sameCategory.length ? notInArray(videos.id, sameCategory.map((v) => v.id)) : undefined,
      ),
    )
    .orderBy(desc(videos.publishedAt))
    .limit(limit - sameCategory.length)
  return [...sameCategory, ...fill]
}

export const DATE_RANGES = { '7d': 7, '30d': 30, all: null } as const
export type DateRange = keyof typeof DATE_RANGES
export const PAGE_SIZE = 10

export async function searchVideos(params: {
  q: string
  categories: string[]
  verifiedOnly: boolean
  range: DateRange
  page: number
}) {
  const conditions = [isPublished]
  const q = params.q.trim().slice(0, 100)
  if (q) {
    // Escape LIKE wildcards so user input is matched literally.
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    conditions.push(
      // utf8mb4_unicode_ci collation makes LIKE case- and accent-insensitive.
      or(like(videos.title, pattern), like(videos.summary, pattern), like(videos.description, pattern))!,
    )
  }
  if (params.categories.length) conditions.push(inArray(cats.slug, params.categories))
  if (params.verifiedOnly) conditions.push(eq(videos.verified, true))
  const days = DATE_RANGES[params.range]
  if (days) conditions.push(gte(videos.publishedAt, new Date(Date.now() - days * 86_400_000)))

  const where = and(...conditions)
  const [rows, [total]] = await Promise.all([
    cardQuery()
      .where(where)
      .orderBy(desc(videos.publishedAt))
      .limit(PAGE_SIZE)
      .offset((params.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(videos).leftJoin(cats, eq(cats.id, videos.categoryId)).where(where),
  ])
  return { rows, total: total?.n ?? 0 }
}

/* ------------------------------------------------------------------ */
/* Live events (any number may be live at once)                         */
/* ------------------------------------------------------------------ */

const ev = schema.liveEvents
const replay = alias(videos, 'replay')

const eventColumns = {
  id: ev.id,
  title: ev.title,
  description: ev.description,
  city: ev.city,
  venue: ev.venue,
  provider: ev.provider,
  providerRef: ev.providerRef,
  // Public playback id only; it exists only while the event is on air.
  muxPublicPlaybackId: ev.muxPublicPlaybackId,
  status: ev.status,
  featured: ev.featured,
  startsAt: ev.startsAt,
  endsAt: ev.endsAt,
  startedAt: ev.startedAt,
  categoryName: cats.name,
  // Only a *published* replay is linked publicly.
  replaySlug: sql<string | null>`case when ${replay.status} = 'published' then ${replay.slug} else null end`,
}

export type PublicLiveEvent = Awaited<ReturnType<typeof getLiveEvents>>[number]

function eventQuery() {
  return db
    .select(eventColumns)
    .from(ev)
    .leftJoin(cats, eq(cats.id, ev.categoryId))
    .leftJoin(replay, eq(replay.id, ev.replayVideoId))
}

/** Every event currently on air; featured first. */
export async function getLiveEvents() {
  return eventQuery()
    .where(and(eq(ev.status, 'live'), or(isNotNull(ev.muxPublicPlaybackId), isNotNull(ev.providerRef))))
    .orderBy(desc(ev.featured), asc(ev.startedAt))
}

export async function getLiveEvent(id: string) {
  const rows = await eventQuery().where(eq(ev.id, id)).limit(1)
  return rows[0] ?? null
}

/** Live now plus what is coming up next (used by the home and live pages). */
export async function getUpcomingEvents(limit: number) {
  return eventQuery()
    .where(
      or(
        eq(ev.status, 'live'),
        and(eq(ev.status, 'scheduled'), gte(ev.startsAt, new Date(Date.now() - 60 * 60 * 1000))),
      ),
    )
    .orderBy(desc(eq(ev.status, 'live')), asc(ev.startsAt))
    .limit(limit)
}

/** All events whose start falls inside [start, end), optionally for one city. */
export async function getScheduleForRange(start: Date, end: Date, city: string | null) {
  const conds = [gte(ev.startsAt, start), lt(ev.startsAt, end)]
  if (city) conds.push(eq(ev.city, city))
  return eventQuery()
    .where(and(...conds))
    .orderBy(asc(ev.startsAt))
    .limit(200)
}

export async function getScheduleCities() {
  const rows = await db
    .selectDistinct({ city: ev.city })
    .from(ev)
    .where(isNotNull(ev.city))
    .orderBy(asc(ev.city))
  return rows.map((r) => r.city!).filter(Boolean)
}

export async function getSitemapEntries() {
  return db
    .select({ slug: videos.slug, updatedAt: videos.updatedAt })
    .from(videos)
    .where(isPublished)
    .orderBy(desc(videos.publishedAt))
    .limit(5000)
}
