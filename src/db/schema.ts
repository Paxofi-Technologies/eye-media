/**
 * MySQL / MariaDB schema (target: cPanel MariaDB 10.6+ / MySQL 8).
 * Portability rules:
 *  - ids are UUID strings generated in the app (MySQL has no RETURNING);
 *  - JSON is stored as TEXT via `jsonText` (MariaDB's JSON type is only a LONGTEXT alias);
 *  - all datetimes are stored in UTC (the connection is opened with timezone 'Z').
 */
import { randomUUID } from 'node:crypto'
import {
  mysqlTable,
  mysqlEnum,
  char,
  varchar,
  text,
  boolean,
  int,
  datetime,
  index,
  uniqueIndex,
  customType,
} from 'drizzle-orm/mysql-core'

const id = () => char('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID())
const ref = (name: string) => char(name, { length: 36 })
const ts = (name: string) => datetime(name, { mode: 'date', fsp: 3 })
const now = () => new Date()

const jsonText = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => 'text',
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => JSON.parse(value) as T,
  })(name)

/* ------------------------------------------------------------------ */
/* Identity & access                                                   */
/* ------------------------------------------------------------------ */

// Kept deliberately small (SRS FR-09). Permissions per role live in src/lib/rbac.ts.
export const ROLES = ['admin', 'editor', 'moderator', 'media_manager', 'reporter'] as const

export const users = mysqlTable('users', {
  id: id(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  title: varchar('title', { length: 160 }),
  role: mysqlEnum('role', ROLES).notNull().default('reporter'),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  active: boolean('active').notNull().default(true),
  lastLoginAt: ts('last_login_at'),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
})

// Session id stored here is a SHA-256 hash of the cookie token; the raw token never touches the DB.
export const sessions = mysqlTable(
  'sessions',
  {
    id: char('id', { length: 64 }).primaryKey(),
    userId: ref('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
)

/* ------------------------------------------------------------------ */
/* Eye TV content                                                      */
/* ------------------------------------------------------------------ */

export const videoCategories = mysqlTable('video_categories', {
  id: id(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
})

export const VIDEO_STATUSES = ['draft', 'pending', 'flagged', 'published', 'rejected', 'unpublished'] as const

export const videos = mysqlTable(
  'videos',
  {
    id: id(),
    slug: varchar('slug', { length: 160 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    summary: varchar('summary', { length: 400 }),
    description: text('description'),
    categoryId: ref('category_id').references(() => videoCategories.id, { onDelete: 'set null' }),
    source: mysqlEnum('source', ['staff', 'citizen']).notNull().default('staff'),
    // Provider abstraction (SRS §10): only YouTube for MVP, extendable later.
    provider: mysqlEnum('provider', ['youtube']).notNull().default('youtube'),
    providerRef: varchar('provider_ref', { length: 64 }),
    // Untrusted link supplied by a citizen; only ever shown to staff, never embedded.
    submittedMediaUrl: varchar('submitted_media_url', { length: 500 }),
    thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
    durationSeconds: int('duration_seconds'),
    location: varchar('location', { length: 160 }),
    tags: jsonText<string[]>('tags').notNull().$defaultFn(() => []),
    reporterName: varchar('reporter_name', { length: 120 }),
    reporterId: ref('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    status: mysqlEnum('status', VIDEO_STATUSES).notNull().default('draft'),
    sensitive: boolean('sensitive').notNull().default(false),
    verified: boolean('verified').notNull().default(false),
    featured: boolean('featured').notNull().default(false),
    editorsPick: boolean('editors_pick').notNull().default(false),
    viewCount: int('view_count').notNull().default(0),
    publishedAt: ts('published_at'),
    createdAt: ts('created_at').notNull().$defaultFn(now),
    updatedAt: ts('updated_at').notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex('videos_slug_idx').on(t.slug),
    index('videos_status_published_idx').on(t.status, t.publishedAt),
    index('videos_category_idx').on(t.categoryId),
  ],
)

// PII for citizen submissions is isolated so public queries can never join it by accident (NFR-05).
export const submitterContacts = mysqlTable('submitter_contacts', {
  videoId: ref('video_id')
    .primaryKey()
    .references(() => videos.id, { onDelete: 'cascade' }),
  reference: varchar('reference', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 254 }),
  phone: varchar('phone', { length: 40 }),
  ipHash: char('ip_hash', { length: 64 }),
  consentAt: ts('consent_at').notNull(),
})

export const moderationReviews = mysqlTable(
  'moderation_reviews',
  {
    id: id(),
    videoId: ref('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    reviewerId: ref('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
    decision: mysqlEnum('decision', ['approved', 'rejected', 'flagged', 'note']).notNull(),
    notes: text('notes'),
    checklist: jsonText<Record<string, boolean>>('checklist').notNull().$defaultFn(() => ({})),
    createdAt: ts('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('moderation_reviews_video_idx').on(t.videoId)],
)

/* ------------------------------------------------------------------ */
/* Live stream & schedule                                              */
/* ------------------------------------------------------------------ */

// Single-row table (id = 1). We store only the public YouTube video id needed to embed the
// stream. The YouTube *stream key* is a broadcast secret and deliberately never stored here.
export const liveStream = mysqlTable('live_stream', {
  id: int('id').primaryKey().default(1),
  title: varchar('title', { length: 200 }).notNull().default('Eye TV Live'),
  description: text('description'),
  categoryId: ref('category_id').references(() => videoCategories.id, { onDelete: 'set null' }),
  youtubeVideoId: varchar('youtube_video_id', { length: 64 }),
  status: mysqlEnum('status', ['offline', 'live']).notNull().default('offline'),
  startedAt: ts('started_at'),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
})

export const scheduleItems = mysqlTable(
  'schedule_items',
  {
    id: id(),
    startsAt: ts('starts_at').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    categoryId: ref('category_id').references(() => videoCategories.id, { onDelete: 'set null' }),
    createdAt: ts('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('schedule_items_starts_idx').on(t.startsAt)],
)

/**
 * Live events: any number of scheduled/concurrent broadcasts (one per location, camera or phone).
 * Replaces the single `live_stream` row + `schedule_items`, which are kept read-only until a later
 * release drops them (their data is copied here by migration 0003).
 */
export const LIVE_EVENT_STATUSES = ['scheduled', 'live', 'ended', 'cancelled'] as const

export const liveEvents = mysqlTable(
  'live_events',
  {
    id: id(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    categoryId: ref('category_id').references(() => videoCategories.id, { onDelete: 'set null' }),
    // City/venue shown on the schedule and used by its location filter, e.g. "Lagos", "Abuja".
    city: varchar('city', { length: 80 }),
    venue: varchar('venue', { length: 160 }),
    provider: mysqlEnum('provider', ['youtube']).notNull().default('youtube'),
    // Public YouTube video id of the broadcast. Stream keys never live in Eye TV.
    providerRef: varchar('provider_ref', { length: 64 }),
    status: mysqlEnum('status', LIVE_EVENT_STATUSES).notNull().default('scheduled'),
    featured: boolean('featured').notNull().default(false),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at'),
    startedAt: ts('started_at'),
    endedAt: ts('ended_at'),
    // Archive copy published after the event (goes through the normal video workflow).
    replayVideoId: ref('replay_video_id').references(() => videos.id, { onDelete: 'set null' }),
    createdBy: ref('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: ts('created_at').notNull().$defaultFn(now),
    updatedAt: ts('updated_at').notNull().$defaultFn(now),
  },
  (t) => [
    index('live_events_starts_idx').on(t.startsAt),
    index('live_events_status_idx').on(t.status, t.startsAt),
  ],
)

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export const auditLog = mysqlTable(
  'audit_log',
  {
    id: id(),
    actorId: ref('actor_id').references(() => users.id, { onDelete: 'set null' }),
    // Denormalised so the trail survives user deletion.
    actorName: varchar('actor_name', { length: 120 }).notNull(),
    action: varchar('action', { length: 60 }).notNull(),
    targetType: varchar('target_type', { length: 40 }).notNull(),
    targetId: varchar('target_id', { length: 64 }),
    targetLabel: varchar('target_label', { length: 200 }),
    notes: text('notes'),
    createdAt: ts('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('audit_log_created_idx').on(t.createdAt), index('audit_log_action_idx').on(t.action)],
)

export type User = typeof users.$inferSelect
export type Role = (typeof ROLES)[number]
export type Video = typeof videos.$inferSelect
export type VideoStatus = (typeof VIDEO_STATUSES)[number]
export type VideoCategory = typeof videoCategories.$inferSelect
export type LiveEvent = typeof liveEvents.$inferSelect
export type LiveEventStatus = (typeof LIVE_EVENT_STATUSES)[number]
