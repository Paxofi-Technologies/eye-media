'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field } from '@/components/Field'
import { VideoUpload } from '@/components/VideoUpload'
import { submitStory, type SubmitState } from './actions'

export function SubmitForm({ categories, uploadsEnabled }: { categories: { slug: string; name: string }[]; uploadsEnabled: boolean }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitStory, { status: 'idle' })

  if (state.status === 'success') {
    return (
      <div className="form-card" role="status">
        <h2>Thank you — your story is with our editors</h2>
        <p>
          Your reference is <strong style={{ fontSize: '1.1rem' }}>{state.reference}</strong>. Keep it in case an
          editor contacts you. Nothing is published until it has been reviewed under our{' '}
          <Link href="/tv/editorial-policy">editorial policy</Link>.
        </p>
        <Link className="btn btn-ghost" href="/tv">
          Back to Eye TV
        </Link>
      </div>
    )
  }

  const errors = state.status === 'error' ? state.errors : {}
  const v = state.status === 'error' ? state.values : {}

  return (
    <form action={action} className="form-card" noValidate>
      {state.status === 'error' && (
        <div className="alert alert-error" role="alert">
          {state.message}
        </div>
      )}

      <div className="form-section">
        <h2>Your story</h2>
        <Field id="title" label="Headline" error={errors.title}>
          {(p) => <input {...p} name="title" required maxLength={200} defaultValue={v.title} />}
        </Field>
        <Field id="description" label="What happened?" hint="Who, what, when and where. Stick to what you saw." error={errors.description}>
          {(p) => <textarea {...p} name="description" required maxLength={4000} rows={6} defaultValue={v.description} />}
        </Field>
        <div className="field-row">
          <Field id="category" label="Category" error={errors.category}>
            {(p) => (
              <select {...p} name="category" required defaultValue={v.category ?? ''}>
                <option value="" disabled>
                  Choose…
                </option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field id="location" label="Location" hint="e.g. Ojota, Lagos" error={errors.location}>
            {(p) => <input {...p} name="location" required maxLength={160} defaultValue={v.location} />}
          </Field>
        </div>
        {uploadsEnabled && <VideoUpload purpose="citizen" label="Your video (optional)" />}
        {errors.upload && (
          <div className="field-error" role="alert" style={{ marginTop: -8, marginBottom: 12 }}>
            {errors.upload}
          </div>
        )}
        <Field
          id="mediaUrl"
          label={uploadsEnabled ? 'Or paste a link to your video (optional)' : 'Link to your video (optional)'}
          hint="A YouTube, Google Drive or similar https:// link."
          error={errors.mediaUrl}
        >
          {(p) => <input {...p} name="mediaUrl" type="url" inputMode="url" maxLength={500} defaultValue={v.mediaUrl} />}
        </Field>
      </div>

      <div className="form-section">
        <h2>How can an editor reach you?</h2>
        <p className="field-hint" style={{ marginTop: -6, marginBottom: 14 }}>
          Your contact details are only visible to Eye Media editors and are never published.
        </p>
        <Field id="name" label="Your name" error={errors.name}>
          {(p) => <input {...p} name="name" required maxLength={120} autoComplete="name" defaultValue={v.name} />}
        </Field>
        <div className="field-row">
          <Field id="email" label="Email" error={errors.email}>
            {(p) => <input {...p} name="email" type="email" maxLength={254} autoComplete="email" defaultValue={v.email} />}
          </Field>
          <Field id="phone" label="Phone / WhatsApp" error={errors.phone}>
            {(p) => <input {...p} name="phone" type="tel" maxLength={40} autoComplete="tel" defaultValue={v.phone} />}
          </Field>
        </div>
        <div className="hp-field" aria-hidden="true">
          <label htmlFor="website">Leave this empty</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <label className="check">
          <input type="checkbox" name="consent" required aria-describedby={errors.consent ? 'consent-error' : undefined} />
          <span>
            I confirm this is my own footage or I have the right to share it, and I agree that Eye Media may verify,
            edit and publish it under the <Link href="/tv/editorial-policy">editorial policy</Link>.
          </span>
        </label>
        {errors.consent && (
          <div className="field-error" id="consent-error">
            {errors.consent}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send to the newsroom'}
        </button>
      </div>
    </form>
  )
}
