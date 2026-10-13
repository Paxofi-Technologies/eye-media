'use client'

import { useActionState } from 'react'
import { createUser, type ActionState } from '@/app/admin/actions'
import { Field } from '@/components/Field'
import { ROLE_LABELS } from '@/lib/rbac'
import { PASSWORD_MIN } from '@/lib/validation'

export function CreateUserForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createUser, { ok: false, message: null })
  const e = state.errors ?? {}
  return (
    <form action={action} className="form-panel" key={state.ok ? state.message : 'form'}>
      <h2>Add staff member</h2>
      {state.message && (
        <div className={state.ok ? 'alert alert-success' : 'alert alert-error'} role={state.ok ? 'status' : 'alert'}>
          {state.message}
        </div>
      )}
      <Field id="u-name" label="Full name" error={e.name}>
        {(p) => <input {...p} name="name" required maxLength={120} />}
      </Field>
      <Field id="u-email" label="Email" error={e.email}>
        {(p) => <input {...p} name="email" type="email" required maxLength={254} autoComplete="off" />}
      </Field>
      <Field id="u-title" label="Job title" hint='Shown on published reports, e.g. "Field correspondent, Lagos Mainland"' error={e.title}>
        {(p) => <input {...p} name="title" maxLength={160} />}
      </Field>
      <Field id="u-role" label="Role" error={e.role}>
        {(p) => (
          <select {...p} name="role" defaultValue="reporter">
            {Object.entries(ROLE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        )}
      </Field>
      <Field id="u-password" label="Temporary password" hint={`At least ${PASSWORD_MIN} characters.`} error={e.password}>
        {(p) => <input {...p} name="password" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" />}
      </Field>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create user'}
      </button>
    </form>
  )
}
