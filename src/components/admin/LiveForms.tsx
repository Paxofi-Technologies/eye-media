'use client'

import { useActionState } from 'react'
import { saveLiveEvent, type ActionState } from '@/app/admin/actions'
import { Field } from '@/components/Field'

type Cat = { id: string; name: string }

export type LiveEventFormValues = {
  id: string
  title: string
  description: string | null
  categoryId: string | null
  city: string | null
  venue: string | null
  startsAt: Date
  endsAt: Date | null
  providerRef: string | null
  featured: boolean
}

/** Date → value for <input type="datetime-local"> in Lagos time (UTC+1). */
function toLagosInput(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)
}

export function LiveEventForm({
  initial,
  categories,
  cities,
}: {
  initial: LiveEventFormValues | null
  categories: Cat[]
  cities: string[]
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveLiveEvent, { ok: false, message: null })
  const e = state.errors ?? {}
  const v = initial
  return (
    <form action={action} className="form-panel" key={state.ok ? state.message : 'form'}>
      <h2>{v ? 'Event details' : 'Schedule a live event'}</h2>
      {state.message && (
        <div className={state.ok ? 'alert alert-success' : 'alert alert-error'} role={state.ok ? 'status' : 'alert'}>
          {state.message}
        </div>
      )}
      <input type="hidden" name="id" value={v?.id ?? ''} />
      <Field id="le-title" label="Title" error={e.title}>
        {(p) => <input {...p} name="title" required maxLength={200} defaultValue={v?.title ?? ''} />}
      </Field>
      <div className="field-row">
        <Field id="le-start" label="Starts (Lagos time)" error={e.startsAt}>
          {(p) => <input {...p} name="startsAt" type="datetime-local" required defaultValue={toLagosInput(v?.startsAt)} />}
        </Field>
        <Field id="le-end" label="Ends (optional)" error={e.endsAt}>
          {(p) => <input {...p} name="endsAt" type="datetime-local" defaultValue={toLagosInput(v?.endsAt)} />}
        </Field>
      </div>
      <div className="field-row">
        <Field id="le-city" label="City" hint="Used by the schedule's city filter" error={e.city}>
          {(p) => (
            <>
              <input {...p} name="city" maxLength={80} list="le-cities" defaultValue={v?.city ?? ''} placeholder="e.g. Lagos" />
              <datalist id="le-cities">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field id="le-venue" label="Venue" error={e.venue}>
          {(p) => <input {...p} name="venue" maxLength={160} defaultValue={v?.venue ?? ''} placeholder="e.g. Ajah field desk" />}
        </Field>
      </div>
      <div className="field-row">
        <Field id="le-cat" label="Category" error={e.categoryId}>
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
        <Field
          id="le-yt"
          label="YouTube Live video"
          hint="Watch URL or id of this broadcast in YouTube Studio. Required before going live."
          error={e.youtube}
        >
          {(p) => <input {...p} name="youtube" maxLength={200} defaultValue={v?.providerRef ?? ''} placeholder="https://youtube.com/live/…" />}
        </Field>
      </div>
      <Field id="le-desc" label="Description" error={e.description}>
        {(p) => <textarea {...p} name="description" maxLength={2000} rows={3} defaultValue={v?.description ?? ''} />}
      </Field>
      <label className="check">
        <input type="checkbox" name="featured" defaultChecked={v?.featured} /> Feature on the homepage when live
      </label>
      <p className="field-hint">Stream keys and ingest URLs stay in YouTube Studio / OBS / the phone app and are never stored in Eye TV.</p>
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? 'Saving…' : v ? 'Save changes' : 'Add to schedule'}
      </button>
    </form>
  )
}
