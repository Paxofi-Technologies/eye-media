'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { recordAudit } from '@/lib/audit'
import { AuthzError, authorize, destroySession, getCurrentUser, hashPassword } from '@/lib/auth'
import { slugSuffix } from '@/lib/ids'
import { RESERVED_SLUGS, videoSlug } from '@/lib/slug'
import {
  MODERATION_CHECKLIST,
  createUserSchema,
  fieldErrors,
  formToObject,
  liveSettingsSchema,
  moderationSchema,
  scheduleItemSchema,
  videoSchema,
  videoStatusChangeSchema,
  type FieldErrors,
} from '@/lib/validation'

export type ActionState = { ok: boolean; message: string | null; errors?: FieldErrors }
function denied(): ActionState {
  return { ok: false, message: 'Your role does not allow this action.' }
}

function revalidatePublic() {
  revalidatePath('/tv', 'layout')
}

/** Checks that must pass before anything goes live on the public site. */
function publishBlocker(v: { providerRef: string | null; categoryId: string | null }): string | null {
  if (!v.providerRef) return 'Attach the Eye TV YouTube video before publishing.'
  if (!v.categoryId) return 'Choose a category before publishing.'
  return null
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export async function logout() {
  const user = await getCurrentUser()
  if (user) await recordAudit(user, 'auth.logout', { type: 'user', id: user.id, label: user.email })
  await destroySession()
  redirect('/admin/login')
}

/* ------------------------------------------------------------------ */
/* Moderation                                                          */
/* ------------------------------------------------------------------ */

export async function moderate(_prev: ActionState, form: FormData): Promise<ActionState> {
  let user
  try {
    user = await authorize('queue.moderate')
  } catch (e) {
    if (e instanceof AuthzError) return denied()
    throw e
  }

  const checklist = Object.fromEntries(MODERATION_CHECKLIST.map((c) => [c.key, form.get(`check_${c.key}`) === 'on']))
  const parsed = moderationSchema.safeParse({
    videoId: form.get('videoId'),
    decision: form.get('decision'),
    notes: form.get('notes') ?? '',
    checklist,
  })
  if (!parsed.success) return { ok: false, message: 'Invalid moderation request.' }
  const { videoId, decision, notes } = parsed.data

  const [video] = await db.select().from(schema.videos).where(eq(schema.videos.id, videoId)).limit(1)
  if (!video) return { ok: false, message: 'This item no longer exists.' }
  if (video.status !== 'pending' && video.status !== 'flagged') {
    return { ok: false, message: 'This item has already been moderated by someone else.' }
  }

  if (decision === 'approved') {
    if (!Object.values(checklist).every(Boolean)) {
      return { ok: false, message: 'Complete every verification check before approving.' }
    }
    const blocker = publishBlocker(video)
    if (blocker) return { ok: false, message: blocker }
  }
  if (decision !== 'approved' && !notes) {
    return { ok: false, message: 'Add a note explaining why, for the rest of the desk.', errors: { notes: 'Required' } }
  }

  const now = new Date()
  const nextStatus = decision === 'approved' ? 'published' : decision === 'rejected' ? 'rejected' : 'flagged'
  const applied = await db.transaction(async (tx) => {
    // Guard against two editors deciding at once: only update if still in the queue.
    const [result] = await tx
      .update(schema.videos)
      .set({
        status: nextStatus,
        verified: decision === 'approved' ? true : video.verified,
        publishedAt: decision === 'approved' ? (video.publishedAt ?? now) : video.publishedAt,
        updatedAt: now,
      })
      .where(and(eq(schema.videos.id, videoId), eq(schema.videos.status, video.status)))
    if (result.affectedRows === 0) return false
    await tx.insert(schema.moderationReviews).values({ videoId, reviewerId: user.id, decision, notes, checklist })
    return true
  })
  if (!applied) return { ok: false, message: 'Another editor changed this item while you were reviewing it.' }

  await recordAudit(user, `moderation.${decision}`, { type: 'video', id: video.id, label: video.title }, notes)
  revalidatePath('/admin', 'layout')
  if (decision === 'approved') revalidatePublic()
  redirect('/admin')
}

/* ------------------------------------------------------------------ */
/* Video registry                                                      */
/* ------------------------------------------------------------------ */

async function uniqueSlug(desired: string, excludeId: string | null): Promise<string | null> {
  const taken = async (slug: string) => {
    const where = excludeId
      ? and(eq(schema.videos.slug, slug), ne(schema.videos.id, excludeId))
      : eq(schema.videos.slug, slug)
    const rows = await db.select({ id: schema.videos.id }).from(schema.videos).where(where).limit(1)
    return rows.length > 0
  }
  if (!(await taken(desired))) return desired
  for (let i = 0; i < 5; i++) {
    const candidate = videoSlug(desired, slugSuffix())
    if (!(await taken(candidate))) return candidate
  }
  return null
}

export async function saveVideo(_prev: ActionState, form: FormData): Promise<ActionState> {
  let user
  try {
    user = await authorize('video.edit')
  } catch (e) {
    if (e instanceof AuthzError) return denied()
    throw e
  }

  const idParse = z.union([z.uuid(), z.literal('')]).safeParse(form.get('id') ?? '')
  if (!idParse.success) return { ok: false, message: 'Invalid video.' }
  const id = idParse.data || null

  const parsed = videoSchema.safeParse(formToObject(form))
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) }
  const d = parsed.data

  if (d.slug && RESERVED_SLUGS.has(d.slug)) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: { slug: 'That slug is reserved.' } }
  }
  const slug = await uniqueSlug(d.slug || videoSlug(d.title), id)
  if (!slug) return { ok: false, message: 'Could not generate a unique slug; please set one manually.' }
  if (d.slug && slug !== d.slug) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: { slug: 'Another video already uses this slug.' } }
  }

  const values = {
    title: d.title,
    slug,
    summary: d.summary,
    description: d.description,
    categoryId: d.categoryId,
    providerRef: d.youtube,
    durationSeconds: d.duration,
    location: d.location,
    tags: d.tags,
    reporterName: d.reporterName,
    verified: d.verified,
    featured: d.featured,
    editorsPick: d.editorsPick,
    sensitive: d.sensitive,
    updatedAt: new Date(),
  }

  if (id) {
    const [existing] = await db.select().from(schema.videos).where(eq(schema.videos.id, id)).limit(1)
    if (!existing) return { ok: false, message: 'This video no longer exists.' }
    if (existing.status === 'published') {
      const blocker = publishBlocker({ providerRef: values.providerRef, categoryId: values.categoryId })
      if (blocker) return { ok: false, message: `This video is live on Eye TV. ${blocker}` }
    }
    // Only one featured hero at a time.
    await db.transaction(async (tx) => {
      if (values.featured) await tx.update(schema.videos).set({ featured: false }).where(ne(schema.videos.id, id))
      await tx.update(schema.videos).set(values).where(eq(schema.videos.id, id))
    })
    await recordAudit(user, 'video.updated', { type: 'video', id, label: values.title })
    revalidatePath('/admin', 'layout')
    if (existing.status === 'published') revalidatePublic()
    return { ok: true, message: 'Changes saved.' }
  }

  const created = { id: randomUUID() }
  await db.transaction(async (tx) => {
    if (values.featured) await tx.update(schema.videos).set({ featured: false })
    await tx.insert(schema.videos).values({
      ...values,
      id: created.id,
      source: 'staff',
      status: 'draft',
      reporterId: user.id,
      reporterName: values.reporterName ?? user.name,
    })
  })
  await recordAudit(user, 'video.created', { type: 'video', id: created.id, label: values.title })
  revalidatePath('/admin', 'layout')
  redirect(`/admin/videos/${created.id}?created=1`)
}

export async function changeVideoStatus(form: FormData): Promise<void> {
  const parsed = videoStatusChangeSchema.safeParse({ id: form.get('id'), status: form.get('status') })
  if (!parsed.success) throw new Error('Invalid request')
  const { id, status } = parsed.data
  const needs = status === 'published' || status === 'unpublished' ? 'video.publish' : 'video.edit'
  const user = await authorize(needs)

  const [video] = await db.select().from(schema.videos).where(eq(schema.videos.id, id)).limit(1)
  if (!video) redirect('/admin/videos')

  if (status === 'published') {
    const blocker = publishBlocker(video)
    if (blocker) redirect(`/admin/videos/${id}?error=${encodeURIComponent(blocker)}`)
  }

  const now = new Date()
  await db
    .update(schema.videos)
    .set({
      status,
      publishedAt: status === 'published' ? (video.publishedAt ?? now) : video.publishedAt,
      featured: status === 'published' ? video.featured : false,
      updatedAt: now,
    })
    .where(eq(schema.videos.id, id))

  const action =
    status === 'published' ? 'video.published' : status === 'unpublished' ? 'video.unpublished' : 'video.status_changed'
  await recordAudit(user, action, { type: 'video', id, label: video.title }, `${video.status} → ${status}`)
  revalidatePath('/admin', 'layout')
  revalidatePublic()
  redirect(`/admin/videos/${id}`)
}

/* ------------------------------------------------------------------ */
/* Live stream & schedule                                              */
/* ------------------------------------------------------------------ */

export async function saveLiveSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  let user
  try {
    user = await authorize('live.manage')
  } catch (e) {
    if (e instanceof AuthzError) return denied()
    throw e
  }
  const parsed = liveSettingsSchema.safeParse(formToObject(form))
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) }
  const d = parsed.data

  const [current] = await db.select().from(schema.liveStream).where(eq(schema.liveStream.id, 1)).limit(1)
  if (current?.status === 'live' && !d.youtube) {
    return { ok: false, message: 'End the stream before removing its YouTube video.', errors: { youtube: 'Required while live' } }
  }

  const values = { title: d.title, description: d.description, categoryId: d.categoryId, youtubeVideoId: d.youtube, updatedAt: new Date() }
  await db
    .insert(schema.liveStream)
    .values({ id: 1, ...values })
    .onDuplicateKeyUpdate({ set: values })
  await recordAudit(user, 'live.updated', { type: 'live', id: '1', label: d.title })
  revalidatePath('/admin/live')
  revalidatePublic()
  return { ok: true, message: 'Live settings saved.' }
}

export async function setLiveStatus(form: FormData): Promise<void> {
  const user = await authorize('live.manage')
  const goLive = form.get('status') === 'live'
  const [current] = await db.select().from(schema.liveStream).where(eq(schema.liveStream.id, 1)).limit(1)
  if (goLive && !current?.youtubeVideoId) {
    redirect(`/admin/live?error=${encodeURIComponent('Save a YouTube Live video before going live.')}`)
  }
  await db
    .update(schema.liveStream)
    .set({ status: goLive ? 'live' : 'offline', startedAt: goLive ? new Date() : null, updatedAt: new Date() })
    .where(eq(schema.liveStream.id, 1))
  await recordAudit(user, goLive ? 'live.started' : 'live.ended', { type: 'live', id: '1', label: current?.title })
  revalidatePath('/admin/live')
  revalidatePublic()
  redirect('/admin/live')
}

export async function addScheduleItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  let user
  try {
    user = await authorize('schedule.manage')
  } catch (e) {
    if (e instanceof AuthzError) return denied()
    throw e
  }
  const parsed = scheduleItemSchema.safeParse(formToObject(form))
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) }
  const itemId = randomUUID()
  await db.insert(schema.scheduleItems).values({ id: itemId, ...parsed.data })
  await recordAudit(user, 'schedule.created', { type: 'schedule', id: itemId, label: parsed.data.title })
  revalidatePath('/admin/live')
  revalidatePublic()
  return { ok: true, message: 'Added to the schedule.' }
}

export async function deleteScheduleItem(form: FormData): Promise<void> {
  const user = await authorize('schedule.manage')
  const id = z.uuid().parse(form.get('id'))
  const [row] = await db.select().from(schema.scheduleItems).where(eq(schema.scheduleItems.id, id)).limit(1)
  await db.delete(schema.scheduleItems).where(eq(schema.scheduleItems.id, id))
  if (row) await recordAudit(user, 'schedule.deleted', { type: 'schedule', id, label: row.title })
  revalidatePath('/admin/live')
  revalidatePublic()
}

/* ------------------------------------------------------------------ */
/* Staff users                                                         */
/* ------------------------------------------------------------------ */

export async function createUser(_prev: ActionState, form: FormData): Promise<ActionState> {
  let user
  try {
    user = await authorize('users.manage')
  } catch (e) {
    if (e instanceof AuthzError) return denied()
    throw e
  }
  const parsed = createUserSchema.safeParse(formToObject(form))
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) }
  const d = parsed.data
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, d.email)).limit(1)
  if (existing.length) return { ok: false, message: 'Please fix the highlighted fields.', errors: { email: 'A user with this email already exists.' } }

  const newId = randomUUID()
  await db
    .insert(schema.users)
    .values({ id: newId, name: d.name, email: d.email, title: d.title, role: d.role, passwordHash: await hashPassword(d.password) })
  await recordAudit(user, 'user.created', { type: 'user', id: newId, label: d.email }, `Role: ${d.role}`)
  revalidatePath('/admin/users')
  return { ok: true, message: `${d.name} can now sign in. Share the temporary password with them securely.` }
}

export async function setUserActive(form: FormData): Promise<void> {
  const user = await authorize('users.manage')
  const id = z.uuid().parse(form.get('id'))
  const active = form.get('active') === 'true'
  if (id === user.id) throw new Error('You cannot deactivate your own account.')
  await db.update(schema.users).set({ active, updatedAt: new Date() }).where(eq(schema.users.id, id))
  const [row] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, id)).limit(1)
  // Deactivation must end any session the user still holds.
  if (!active) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id))
  if (row) await recordAudit(user, active ? 'user.reactivated' : 'user.deactivated', { type: 'user', id, label: row.email })
  revalidatePath('/admin/users')
}
