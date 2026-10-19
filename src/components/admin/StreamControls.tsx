'use client'

import { useActionState, useState } from 'react'
import { addSimulcast, resetStreamKeyAction, revealStreamKey, type ActionState, type KeyState } from '@/app/admin/actions'
import { Field } from '@/components/Field'

/** Shows the secret stream key only on request (each view is recorded in the audit log). */
export function StreamKey({ eventId, live }: { eventId: string; live: boolean }) {
  const [reveal, revealAction, revealing] = useActionState<KeyState, FormData>(revealStreamKey, { ok: false, message: null })
  const [reset, resetAction, resetting] = useActionState<KeyState, FormData>(resetStreamKeyAction, { ok: false, message: null })
  const [copied, setCopied] = useState(false)
  const key = reset.streamKey ?? reveal.streamKey
  const message = reset.message ?? reveal.message

  return (
    <div className="field">
      <span className="label">Stream key</span>
      {key ? (
        <div className="action-row" style={{ gap: 6 }}>
          <code className="stream-secret" data-testid="stream-key">{key}</code>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(key).then(() => setCopied(true))
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <code className="stream-secret">••••••••••••••••••••</code>
      )}
      {message && <p className={reveal.ok || reset.ok ? 'field-hint' : 'field-error'} role="status">{message}</p>}
      <div className="action-row" style={{ gap: 6, marginTop: 8 }}>
        <form action={revealAction}>
          <input type="hidden" name="id" value={eventId} />
          <button className="btn btn-sm btn-ghost" type="submit" disabled={revealing}>
            {key ? 'Refresh key' : 'Show key'}
          </button>
        </form>
        <form
          action={resetAction}
          onSubmit={(e) => {
            if (!window.confirm('Reset the stream key? Anyone using the old key, including your encoder, will be disconnected.')) e.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={eventId} />
          <button className="btn btn-sm btn-ghost" type="submit" disabled={resetting || live} title={live ? 'End the broadcast first' : undefined}>
            Reset key
          </button>
        </form>
      </div>
      <p className="field-hint">Treat the key like a password: anyone who has it can broadcast on this event.</p>
    </div>
  )
}

export function SimulcastForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addSimulcast, { ok: false, message: null })
  const [kind, setKind] = useState('youtube')
  const e = state.errors ?? {}
  return (
    <form action={action} key={state.ok ? state.message : 'form'}>
      <input type="hidden" name="id" value={eventId} />
      {state.message && (
        <div className={state.ok ? 'alert alert-success' : 'alert alert-error'} role={state.ok ? 'status' : 'alert'}>
          {state.message}
        </div>
      )}
      <div className="field-row">
        <Field id="sc-kind" label="Send a copy to">
          {(p) => (
            <select {...p} name="kind" value={kind} onChange={(ev) => setKind(ev.target.value)}>
              <option value="youtube">YouTube</option>
              <option value="facebook">Facebook</option>
              <option value="custom">Other (RTMP address)</option>
            </select>
          )}
        </Field>
        <Field id="sc-key" label="Stream key from that platform" error={e.key}>
          {(p) => <input {...p} name="key" type="password" autoComplete="off" maxLength={300} required />}
        </Field>
      </div>
      {kind === 'custom' && (
        <Field id="sc-url" label="RTMP address" error={e.url}>
          {(p) => <input {...p} name="url" maxLength={300} placeholder="rtmps://…" required />}
        </Field>
      )}
      <button className="btn btn-sm btn-ghost" type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add destination'}
      </button>
    </form>
  )
}
