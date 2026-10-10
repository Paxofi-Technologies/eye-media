'use client'

import { useActionState } from 'react'
import { saveVideo, type ActionState } from '@/app/admin/actions'
import { Field } from '@/components/Field'
import { formatDuration } from '@/lib/format'

export type VideoFormValues = {
  id?: string
  title: string
  slug: string
  summary: string | null
  description: string | null
  categoryId: string | null
  providerRef: string | null
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
}: {
  initial: VideoFormValues | null
  categories: { id: string; name: string }[]
  canEdit: boolean
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
          <div className="field-row">
            <Field id="youtube" label="YouTube video" hint="Video id or any YouTube URL from the Eye TV channel." error={e.youtube}>
              {(p) => <input {...p} name="youtube" maxLength={200} defaultValue={v?.providerRef ?? ''} placeholder="https://youtu.be/…" />}
            </Field>
            <Field id="duration" label="Duration" hint="m:ss or h:mm:ss" error={e.duration}>
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
