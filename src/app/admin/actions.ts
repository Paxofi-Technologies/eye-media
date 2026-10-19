'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { recordAudit } from '@/lib/audit'
import { AuthzError, authorize, destroySession, getCurrentUser, hashPassword } from '@/lib/auth'
import { publishBlocker } from '@/lib/publish'
import { slugSuffix } from '@/lib/ids'
import { claimUpload, muxFieldsForAsset } from '@/lib/uploads'
import {
  createStreamForEvent,
  deleteAssetQuietly,
  deleteStreamQuietly,
  ensurePublicAssetId,
  importVideoFromUrl,
  removePublicAssetId,
  transitionEvent,
} from '@/lib/mux-ops'
import { addSimulcastTarget, getLiveStream, removeSimulcastTarget, resetStreamKey } from '@/lib/mux'
import { queueEyeReportEvent } from '@/lib/eye-report-callback'
import { canEditVideo } from '@/lib/rbac'
import { RESERVED_SLUGS, videoSlug } from '@/lib/slug'
import {
  MODERATION_CHECKLIST,
  createUserSchema,
  fieldErrors,
  formToObject,
  liveEventSchema,
  liveEventStatusSchema,
  moderationSchema,
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
const mediaErrorText = (e: unknown) => (e instanceof Error ? e.message : 'Unknown error.')

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
  // Approving makes the video public on Mux (adds a public playback id) before it is marked published here.
  let publicId: string | null = video.muxPublicPlaybackId
  const addedPublicId = decision === 'approved' && video.provider === 'mux' && !video.muxPublicPlaybackId
  if (decision === 'approved' && video.provider === 'mux') {
    try {
      publicId = await ensurePublicAssetId(video.muxAssetId!)
    } catch (e) {
      return { ok: false, message: `Could not publish the video on Mux. ${mediaErrorText(e)}` }
    }
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
        muxPublicPlaybackId: decision === 'approved' ? publicId : video.muxPublicPlaybackId,
        updatedAt: now,
      })
      .where(and(eq(schema.videos.id, videoId), eq(schema.videos.status, video.status)))
    if (result.affectedRows === 0) return false
    await tx.insert(schema.moderationReviews).values({ videoId, reviewerId: user.id, decision, notes, checklist })
    return true
  })
  if (!applied) {
    // Don't leave a public link behind for something that was not published.
    if (addedPublicId && publicId) await removePublicAssetId(video.muxAssetId!, publicId).catch(() => undefined)
    return { ok: false, message: 'Another editor changed this item while you were reviewing it.' }
  }

  await recordAudit(user, `moderation.${decision}`, { type: 'video', id: video.id, label: video.title }, notes)
  revalidatePath('/admin', 'layout')
  if (decision === 'approved') revalidatePublic()
  if (decision === 'approved' || decision === 'rejected') await queueEyeReportEvent(video.id, decision === 'approved' ? 'published' : 'rejected')
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

  const existing = id ? (await db.select().from(schema.videos).where(eq(schema.videos.id, id)).limit(1))[0] : undefined
  if (id && !existing) return { ok: false, message: 'This video no longer exists.' }
  if (existing && !canEditVideo(user, existing)) return denied()
  // Reporters cannot promote their own work: editors decide what is featured, verified or an editor's pick.
  if (user.role === 'reporter') {
    values.featured = existing?.featured ?? false
    values.editorsPick = existing?.editorsPick ?? false
    values.verified = existing?.verified ?? false
  }

  // Video source: a newly uploaded file replaces whatever is attached; otherwise nothing about the media changes.
  const uploadId = form.get('uploadId')
  let media: Partial<Awaited<ReturnType<typeof muxFieldsForAsset>>> = {}
  let replacedAssetId: string | null = null
  if (typeof uploadId === 'string' && uploadId) {
    if (existing?.status === 'published') {
      return { ok: false, message: 'Unpublish this video before replacing it.', errors: { upload: 'Unpublish the story first.' } }
    }
    const upload = await claimUpload(uploadId, String(form.get('uploadToken') ?? ''), 'staff')
    if (!upload) {
      return { ok: false, message: 'The video upload did not finish. Please upload it again.', errors: { upload: 'Upload the file again, then save.' } }
    }
    media = { ...(await muxFieldsForAsset(upload.muxAssetId)) }
    if (media.durationSeconds == null) delete media.durationSeconds
    replacedAssetId = existing?.provider === 'mux' ? existing.muxAssetId : null
  } else if (d.videoUrl) {
    // "Paste a link": Mux downloads the file itself. Only direct links to a video file work, not YouTube/Facebook pages.
    if (existing?.status === 'published') {
      return { ok: false, message: 'Unpublish this video before replacing it.', errors: { videoUrl: 'Unpublish the story first.' } }
    }
    try {
      media = { ...(await importVideoFromUrl(d.videoUrl)) }
    } catch (e) {
      return {
        ok: false,
        message: 'Mux could not use that link.',
        errors: { videoUrl: `${mediaErrorText(e)} Use a direct link to a video file (MP4 or MOV), not a YouTube or social media page.` },
      }
    }
    if (media.durationSeconds == null) delete media.durationSeconds
    replacedAssetId = existing?.provider === 'mux' ? existing.muxAssetId : null
  }
  const row = { ...values, ...media }

  if (id && existing) {
    if (existing.status === 'published') {
      const blocker = publishBlocker({ ...existing, categoryId: row.categoryId })
      if (blocker) return { ok: false, message: `This video is live on Eye TV. ${blocker}` }
    }
    // Only one featured hero at a time.
    await db.transaction(async (tx) => {
      if (values.featured) await tx.update(schema.videos).set({ featured: false }).where(ne(schema.videos.id, id))
      await tx.update(schema.videos).set(row).where(eq(schema.videos.id, id))
    })
    // The video that was replaced is no longer needed; deleting it stops its storage cost.
    await deleteAssetQuietly(replacedAssetId)
    await recordAudit(user, 'video.updated', { type: 'video', id, label: values.title }, media.muxAssetId ? 'Replaced the video' : null)
    revalidatePath('/admin', 'layout')
    if (existing.status === 'published') revalidatePublic()
    return { ok: true, message: media.muxAssetId ? 'Saved. The new video is processing and will be ready in a few minutes.' : 'Changes saved.' }
  }

  const created = { id: randomUUID() }
  await db.transaction(async (tx) => {
    if (values.featured) await tx.update(schema.videos).set({ featured: false })
    await tx.insert(schema.videos).values({
      ...row,
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
  // Reporters may only send their own drafts for review, or pull them back to draft.
  if (user.role === 'reporter') {
    const mine = video.reporterId === user.id
    const allowed = (status === 'pending' && (video.status === 'draft' || video.status === 'rejected')) || (status === 'draft' && video.status === 'pending')
    if (!mine || !allowed) redirect(`/admin/videos?error=${encodeURIComponent('You can only send your own drafts for review.')}`)
  }

  if (status === 'published') {
    const blocker = publishBlocker(video)
    if (blocker) redirect(`/admin/videos/${id}?error=${encodeURIComponent(blocker)}`)
  }

  // Keep Mux in step: published videos have a public playback id, everything else is private.
  let publicId = video.muxPublicPlaybackId
  try {
    if (video.provider === 'mux' && video.muxAssetId) {
      if (status === 'published') publicId = await ensurePublicAssetId(video.muxAssetId)
      else if (video.muxPublicPlaybackId) {
        await removePublicAssetId(video.muxAssetId, video.muxPublicPlaybackId)
        publicId = null
      }
    }
  } catch (e) {
    redirect(`/admin/videos/${id}?error=${encodeURIComponent(`Mux could not update access to this video. ${mediaErrorText(e)}`)}`)
  }

  const now = new Date()
  await db
    .update(schema.videos)
    .set({
      status,
      publishedAt: status === 'published' ? (video.publishedAt ?? now) : video.publishedAt,
      featured: status === 'published' ? video.featured : false,
      muxPublicPlaybackId: publicId,
      updatedAt: now,
    })
    .where(eq(schema.videos.id, id))

  const action =
    status === 'published' ? 'video.published' : status === 'unpublished' ? 'video.unpublished' : 'video.status_changed'
  await recordAudit(user, action, { type: 'video', id, label: video.title }, `${video.status} → ${status}`)
  if (status === 'published' || status === 'unpublished') await queueEyeReportEvent(id, status)
  revalidatePath('/admin', 'layout')
  revalidatePublic()
  redirect(`/admin/videos/${id}`)
}

/* ------------------------------------------------------------------ */
/* Live stream & schedule                                              */
/* ------------------------------------------------------------------ */

export async function saveLiveEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  let user
  try {
    user = await authorize('live.manage')
  } catch (e) {
    if (e instanceof AuthzError) return denied()
    throw e
  }
  const idParse = z.union([z.uuid(), z.literal('')]).safeParse(form.get('id') ?? '')
  if (!idParse.success) return { ok: false, message: 'Invalid event.' }
  const id = idParse.data || null

  const parsed = liveEventSchema.safeParse(formToObject(form))
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', errors: fieldErrors(parsed.error) }
  const d = parsed.data

  const values = {
    title: d.title,
    description: d.description,
    categoryId: d.categoryId,
    city: d.city,
    venue: d.venue,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    autoLive: d.autoLive,
    featured: d.featured,
    updatedAt: new Date(),
  }

  if (id) {
    const existing = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.id, id) })
    if (!existing) return { ok: false, message: 'This event no longer exists.' }
    await db.transaction(async (tx) => {
      if (values.featured) await tx.update(schema.liveEvents).set({ featured: false }).where(ne(schema.liveEvents.id, id))
      await tx.update(schema.liveEvents).set(values).where(eq(schema.liveEvents.id, id))
    })
    await recordAudit(user, 'live.event_updated', { type: 'live_event', id, label: values.title })
    revalidatePath('/admin', 'layout')
    revalidatePublic()
    return { ok: true, message: 'Event saved.' }
  }

  const newId = randomUUID()
  await db.transaction(async (tx) => {
    if (values.featured) await tx.update(schema.liveEvents).set({ featured: false })
    await tx.insert(schema.liveEvents).values({ ...values, id: newId, provider: 'mux', status: 'scheduled', createdBy: user.id })
  })
  await recordAudit(user, 'live.event_created', { type: 'live_event', id: newId, label: values.title })
  // The stream is created right away so the encoder details are ready; if Mux is unreachable the editor can retry.
  const stream = await createStreamForEvent(newId)
  if (stream.ok) await recordAudit(user, 'live.stream_created', { type: 'live_event', id: newId, label: values.title })
  revalidatePath('/admin', 'layout')
  revalidatePublic()
  redirect(`/admin/live/${newId}?created=1${stream.ok ? '' : `&error=${encodeURIComponent(stream.message)}`}`)
}

/** Retry button when the stream could not be created with the event (e.g. Mux was not connected yet). */
export async function createLiveStreamAction(form: FormData): Promise<void> {
  const user = await authorize('live.manage')
  const id = z.uuid().parse(form.get('id'))
  const event = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.id, id) })
  if (!event) redirect('/admin/live')
  const res = await createStreamForEvent(id)
  if (!res.ok) redirect(`/admin/live/${id}?error=${encodeURIComponent(res.message)}`)
  await recordAudit(user, 'live.stream_created', { type: 'live_event', id, label: event.title })
  revalidatePath('/admin', 'layout')
  redirect(`/admin/live/${id}`)
}

export async function setLiveEventStatus(form: FormData): Promise<void> {
  const user = await authorize('live.manage')
  const parsed = liveEventStatusSchema.safeParse({ id: form.get('id'), status: form.get('status') })
  if (!parsed.success) throw new Error('Invalid request')
  const { id, status } = parsed.data
  const back = form.get('back') === 'detail' ? `/admin/live/${id}` : '/admin/live'

  const event = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.id, id) })
  if (!event) redirect('/admin/live')

  const res = await transitionEvent(id, status, 'staff')
  if (!res.ok) redirect(`${back}?error=${encodeURIComponent(res.message)}`)

  if (res.changed) {
    const action =
      status === 'live' ? 'live.started' : status === 'ended' ? 'live.ended' : status === 'cancelled' ? 'live.cancelled' : 'live.event_updated'
    await recordAudit(user, action, { type: 'live_event', id, label: event.title }, `${event.status} → ${status}`)
  }
  revalidatePath('/admin', 'layout')
  revalidatePublic()
  redirect(res.warning ? `${back}?error=${encodeURIComponent(res.warning)}` : back)
}

export async function deleteLiveEvent(form: FormData): Promise<void> {
  const user = await authorize('live.manage')
  const id = z.uuid().parse(form.get('id'))
  const event = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.id, id) })
  if (!event) redirect('/admin/live')
  // Anything that has been on air is part of the record: end or cancel it instead.
  if (event.status === 'live' || event.startedAt) {
    redirect(`/admin/live/${id}?error=${encodeURIComponent('Events that have been on air cannot be deleted.')}`)
  }
  await deleteStreamQuietly(event)
  await db.delete(schema.liveEvents).where(eq(schema.liveEvents.id, id))
  await recordAudit(user, 'live.event_deleted', { type: 'live_event', id, label: event.title })
  revalidatePath('/admin', 'layout')
  revalidatePublic()
  redirect('/admin/live')
}

/* ---- Stream key & simulcast (the key is a secret: it is never stored by us and never put in a page) ---- */

export type KeyState = { ok: boolean; message: string | null; streamKey?: string }

async function streamOf(form: FormData) {
  const id = z.uuid().parse(form.get('id'))
  const event = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.id, id) })
  if (!event?.muxLiveStreamId) return null
  return { id, event, streamId: event.muxLiveStreamId }
}

/** Shows the stream key to an authorised editor for this one request, and records that it was viewed. */
export async function revealStreamKey(_prev: KeyState, form: FormData): Promise<KeyState> {
  let user
  try {
    user = await authorize('live.manage')
  } catch (e) {
    if (e instanceof AuthzError) return { ok: false, message: 'You do not have permission to do that.' }
    throw e
  }
  const s = await streamOf(form)
  if (!s) return { ok: false, message: 'This event has no Mux stream yet.' }
  try {
    const stream = await getLiveStream(s.streamId)
    await recordAudit(user, 'live.key_viewed', { type: 'live_event', id: s.id, label: s.event.title })
    return { ok: true, message: null, streamKey: stream.stream_key }
  } catch (e) {
    return { ok: false, message: mediaErrorText(e) }
  }
}

export async function resetStreamKeyAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  let user
  try {
    user = await authorize('live.manage')
  } catch (e) {
    if (e instanceof AuthzError) return { ok: false, message: 'You do not have permission to do that.' }
    throw e
  }
  const s = await streamOf(form)
  if (!s) return { ok: false, message: 'This event has no Mux stream yet.' }
  if (s.event.status === 'live') return { ok: false, message: 'End the broadcast before resetting the key.' }
  try {
    const stream = await resetStreamKey(s.streamId)
    await recordAudit(user, 'live.key_reset', { type: 'live_event', id: s.id, label: s.event.title })
    return { ok: true, message: 'The old key no longer works. Use the new one in your encoder.', streamKey: stream.stream_key }
  } catch (e) {
    return { ok: false, message: mediaErrorText(e) }
  }
}

const simulcastSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['youtube', 'facebook', 'custom']),
  url: z.string().trim().max(300).optional(),
  key: z.string().trim().min(4, 'Enter the stream key.').max(300),
})

const SIMULCAST_URLS = {
  youtube: 'rtmps://a.rtmps.youtube.com/live2',
  facebook: 'rtmps://live-api-s.facebook.com:443/rtmp/',
} as const

export async function addSimulcast(_prev: ActionState, form: FormData): Promise<ActionState> {
  let user
  try {
    user = await authorize('live.manage')
  } catch (e) {
    if (e instanceof AuthzError) return denied()
    throw e
  }
  const parsed = simulcastSchema.safeParse(formToObject(form))
  if (!parsed.success) return { ok: false, message: 'Check the stream key.', errors: fieldErrors(parsed.error) }
  const { kind, key } = parsed.data
  const url = kind === 'custom' ? parsed.data.url : SIMULCAST_URLS[kind]
  if (!url || !/^rtmps?:\/\/[^\s]+$/i.test(url)) {
    return { ok: false, message: 'Enter a valid RTMP address (starting with rtmp:// or rtmps://).', errors: { url: 'Invalid address' } }
  }
  const s = await streamOf(form)
  if (!s) return { ok: false, message: 'This event has no Mux stream yet.' }
  try {
    await addSimulcastTarget(s.streamId, { url, streamKey: key, passthrough: kind })
  } catch (e) {
    return { ok: false, message: mediaErrorText(e) }
  }
  await recordAudit(user, 'live.simulcast_added', { type: 'live_event', id: s.id, label: s.event.title }, kind)
  revalidatePath(`/admin/live/${s.id}`)
  return { ok: true, message: 'Destination added. It starts receiving the next time the stream goes live.' }
}

export async function removeSimulcast(form: FormData): Promise<void> {
  const user = await authorize('live.manage')
  const s = await streamOf(form)
  const targetId = z.string().min(1).max(100).parse(form.get('targetId'))
  if (!s) redirect('/admin/live')
  try {
    await removeSimulcastTarget(s.streamId, targetId)
  } catch (e) {
    redirect(`/admin/live/${s.id}?error=${encodeURIComponent(mediaErrorText(e))}`)
  }
  await recordAudit(user, 'live.simulcast_removed', { type: 'live_event', id: s.id, label: s.event.title })
  revalidatePath(`/admin/live/${s.id}`)
  redirect(`/admin/live/${s.id}`)
}

/** Turns an ended broadcast into a draft archive video (published through the normal workflow). */
export async function createReplayFromEvent(form: FormData): Promise<void> {
  const user = await authorize('video.edit')
  await authorize('live.manage')
  const id = z.uuid().parse(form.get('id'))
  const event = await db.query.liveEvents.findFirst({ where: eq(schema.liveEvents.id, id) })
  if (!event) redirect('/admin/live')
  if (event.replayVideoId) redirect(`/admin/videos/${event.replayVideoId}`)
  if (event.status !== 'ended' || !(event.recordingAssetId || event.providerRef)) {
    redirect(`/admin/live/${id}?error=${encodeURIComponent('The recording is not available yet. Mux finishes it a few minutes after the stream ends.')}`)
  }

  const videoId = randomUUID()
  const slug = await uniqueSlug(videoSlug(event.title), null)
  if (!slug) redirect(`/admin/live/${id}?error=${encodeURIComponent('Could not generate a slug for the replay.')}`)
  const duration =
    event.startedAt && event.endedAt ? Math.round((event.endedAt.getTime() - event.startedAt.getTime()) / 1000) : null
  const media = event.recordingAssetId
    ? await muxFieldsForAsset(event.recordingAssetId)
    : { provider: 'youtube' as const, providerRef: event.providerRef, durationSeconds: duration }
  await db.transaction(async (tx) => {
    await tx.insert(schema.videos).values({
      id: videoId,
      slug,
      title: event.title,
      summary: event.description?.slice(0, 400) ?? null,
      description: event.description,
      categoryId: event.categoryId,
      ...media,
      durationSeconds: media.durationSeconds ?? duration,
      location: [event.venue, event.city].filter(Boolean).join(', ') || null,
      tags: ['live', 'replay'],
      reporterName: 'Eye TV Live',
      reporterId: user.id,
      source: 'staff',
      status: 'draft',
    })
    await tx.update(schema.liveEvents).set({ replayVideoId: videoId, updatedAt: new Date() }).where(eq(schema.liveEvents.id, id))
  })
  await recordAudit(user, 'live.replay_created', { type: 'video', id: videoId, label: event.title })
  revalidatePath('/admin', 'layout')
  redirect(`/admin/videos/${videoId}?created=1`)
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
