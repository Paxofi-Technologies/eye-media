'use client'

import { useActionState } from 'react'
import { addScheduleItem, saveLiveSettings, type ActionState } from '@/app/admin/actions'
import { Field } from '@/components/Field'

type Cat = { id: string; name: string }

function Message({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <div className={state.ok ? 'alert alert-success' : 'alert alert-error'} role={state.ok ? 'status' : 'alert'}>
      {state.message}
    </div>
  )
}

export function LiveSettingsForm({
  initial,
  categories,
}: {
  initial: { title: string; description: string | null; categoryId: string | null; youtubeVideoId: string | null } | null
  categories: Cat[]
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveLiveSettings, { ok: false, message: null })
  const e = state.errors ?? {}
  return (
    <form action={action} className="form-panel">
      <h2>Stream settings</h2>
      <Message state={state} />
      <Field id="title" label="Stream title" error={e.title}>
        {(p) => <input {...p} name="title" required maxLength={200} defaultValue={initial?.title ?? ''} />}
      </Field>
      <div className="field-row">
        <Field id="categoryId" label="Category" error={e.categoryId}>
          {(p) => (
            <select {...p} name="categoryId" defaultValue={initial?.categoryId ?? ''}>
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field
          id="youtube"
          label="YouTube Live video"
          hint="The watch URL or video id of the scheduled broadcast in YouTube Studio."
          error={e.youtube}
        >
          {(p) => <input {...p} name="youtube" maxLength={200} defaultValue={initial?.youtubeVideoId ?? ''} placeholder="https://youtube.com/live/…" />}
        </Field>
      </div>
      <Field id="description" label="Description" error={e.description}>
        {(p) => <textarea {...p} name="description" maxLength={2000} rows={3} defaultValue={initial?.description ?? ''} />}
      </Field>
      <p className="field-hint" style={{ marginTop: -6 }}>
        Stream keys and ingest URLs stay in YouTube Studio / OBS and are never stored in Eye TV.
      </p>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}

export function ScheduleForm({ categories }: { categories: Cat[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addScheduleItem, { ok: false, message: null })
  const e = state.errors ?? {}
  return (
    <form action={action} key={state.ok ? state.message : 'form'}>
      <Message state={state} />
      <Field id="s-title" label="Programme" error={e.title}>
        {(p) => <input {...p} name="title" required maxLength={200} />}
      </Field>
      <Field id="s-start" label="Starts (Lagos time)" error={e.startsAt}>
        {(p) => <input {...p} name="startsAt" type="datetime-local" required />}
      </Field>
      <Field id="s-cat" label="Category" error={e.categoryId}>
        {(p) => (
          <select {...p} name="categoryId" defaultValue="">
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </Field>
      <button className="btn btn-ghost" type="submit" disabled={pending}>
        Add to schedule
      </button>
    </form>
  )
}
