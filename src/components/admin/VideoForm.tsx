'use client'

import { useActionState } from 'react'
import { saveVideo, type ActionState } from '@/app/admin/actions'
import { Field } from '@/components/Field'
import { VideoUpload } from '@/components/VideoUpload'
import { formatDuration } from '@/lib/format'

export type VideoFormValues = {
  id?: string
  title: string
  slug: string
  summary: string | null
  description: string | null
  categoryId: string | null
  provider: 'youtube' | 'upload' | 'mux'
  providerRef: string | null
  mediaStatus: 'ready' | 'processing' | 'errored'
  status: string
  durationSeconds: number | null
  location: string | null
  tags: string[]
  reporterName: string | null
  verified: boolean
  featured: boolean
  editorsPick: boolean
  sensitive: boolean
}

export function VideoForm({
  initial,
  categories,
  canEdit,
  uploadsEnabled,
}: {
  initial: VideoFormValues | null
  categories: { id: string; name: string }[]
  canEdit: boolean
  uploadsEnabled: boolean
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveVideo, { ok: false, message: null })
  const e = state.errors ?? {}
  const v = initial

  return (
    <form action={action}>
      <input type="hidden" name="id" value={v?.id ?? ''} />
      {state.message && (
        <div className={state.ok ? 'alert alert-success' : 'alert alert-error'} role={state.ok ? 'status' : 'alert'}>
          {state.message}
        </div>
      )}
      <fieldset disabled={!canEdit || pending} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-panel">
          <h2>Story</h2>
          <Field id="title" label="Title" error={e.title}>
            {(p) => <input {...p} name="title" required maxLength={200} defaultValue={v?.title} />}
          </Field>
          <Field id="summary" label="Summary" hint="One or two sentences shown on cards and in search results." error={e.summary}>
            {(p) => <textarea {...p} name="summary" maxLength={400} rows={2} defaultValue={v?.summary ?? ''} />}
          </Field>
          <Field id="description" label="Description" error={e.description}>
            {(p) => <textarea {...p} name="description" maxLength={10000} rows={6} defaultValue={v?.description ?? ''} />}
          </Field>
          <div className="field-row">
            <Field id="categoryId" label="Category" error={e.categoryId}>
              {(p) => (
                <select {...p} name="categoryId" defaultValue={v?.categoryId ?? ''}>
                  <option value="">— None —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field id="location" label="Location" error={e.location}>
              {(p) => <input {...p} name="location" maxLength={160} defaultValue={v?.location ?? ''} placeholder="e.g. Ajah, Lagos" />}
            </Field>
          </div>
          <div className="field-row">
            <Field id="reporterName" label="Reporter credit" error={e.reporterName}>
              {(p) => <input {...p} name="reporterName" maxLength={120} defaultValue={v?.reporterName ?? ''} />}
            </Field>
            <Field id="tags" label="Tags" hint="Comma-separated" error={e.tags}>
              {(p) => <input {...p} name="tags" maxLength={500} defaultValue={v?.tags.join(', ') ?? ''} />}
            </Field>
          </div>
        </div>

        <div className="form-panel">
          <h2>Video</h2>
          <p className="field-hint" style={{ marginTop: -6 }}>
            {!v?.id
              ? 'No video yet.'
              : v.provider === 'mux'
                ? v.mediaStatus === 'ready'
                  ? 'Current video: ready to play.'
                  : v.mediaStatus === 'processing'
                    ? 'Current video: still processing (usually a few minutes). This page updates when it is ready.'
                    : 'Current video: processing failed. Upload the file again.'
                : v.provider === 'youtube' && v.providerRef
                  ? 'Current video: a legacy YouTube video. Upload the file to replace it.'
                  : v.provider === 'upload'
                    ? 'Current video: a file stored on this server (legacy). Upload the file again to move it to Mux.'
                    : 'No video yet.'}
          </p>
          {canEdit && v?.status === 'published' ? (
            <p className="field-hint">To replace the video, unpublish this story first.</p>
          ) : uploadsEnabled && canEdit ? (
            <VideoUpload purpose="staff" label={v?.id ? 'Replace the video' : 'Upload a video file'} />
          ) : canEdit ? (
            <div className="alert alert-info" role="status">
              Video upload isn&apos;t set up yet. Add the Mux access token and signing key (see the Mux setup guide), then restart the app.
            </div>
          ) : null}
          {uploadsEnabled && canEdit && v?.status !== 'published' && (
            <Field
              id="videoUrl"
              label="Or paste a link to the video"
              hint="A direct https link to a video file (MP4 or MOV), for example a download link from cloud storage. Links to YouTube, Facebook, Instagram or TikTok pages cannot be imported. If you also upload a file, the upload is used."
              error={e.videoUrl}
            >
              {(p) => <input {...p} name="videoUrl" type="url" maxLength={2000} placeholder="https://…/video.mp4" autoComplete="off" />}
            </Field>
          )}
          {e.upload && (
            <div className="field-error" role="alert" style={{ marginTop: -8, marginBottom: 12 }}>
              {e.upload}
            </div>
          )}
          <div className="field-row">
            <Field id="duration" label="Duration" hint="Filled in automatically from the video. m:ss or h:mm:ss" error={e.duration}>
              {(p) => <input {...p} name="duration" maxLength={12} defaultValue={formatDuration(v?.durationSeconds) ?? ''} />}
            </Field>
          </div>
          <Field id="slug" label="URL slug" hint="Leave blank to generate from the title." error={e.slug}>
            {(p) => <input {...p} name="slug" maxLength={160} defaultValue={v?.slug ?? ''} pattern="[a-z0-9]+(-[a-z0-9]+)*" />}
          </Field>
        </div>

        <div className="form-panel">
          <h2>Editorial flags</h2>
          <div className="check-grid">
            <label className="check">
              <input type="checkbox" name="verified" defaultChecked={v?.verified} /> Verified by Eye Media
            </label>
            <label className="check">
              <input type="checkbox" name="featured" defaultChecked={v?.featured} /> Featured on homepage hero
            </label>
            <label className="check">
              <input type="checkbox" name="editorsPick" defaultChecked={v?.editorsPick} /> Editor&apos;s pick
            </label>
            <label className="check">
              <input type="checkbox" name="sensitive" defaultChecked={v?.sensitive} /> Sensitive content
            </label>
          </div>
        </div>

        {canEdit && (
          <div className="action-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" type="submit">
              {pending ? 'Saving…' : v?.id ? 'Save changes' : 'Create draft'}
            </button>
          </div>
        )}
      </fieldset>
    </form>
  )
}
