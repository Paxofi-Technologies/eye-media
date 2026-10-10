'use client'

import { useActionState, useState } from 'react'
import { moderate, type ActionState } from '@/app/admin/actions'
import { MODERATION_CHECKLIST } from '@/lib/validation'

export function ReviewForm({ videoId, canPublish, publishHint }: { videoId: string; canPublish: boolean; publishHint: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(moderate, { ok: false, message: null })
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const allChecked = MODERATION_CHECKLIST.every((c) => checked[c.key])

  return (
    <form action={action}>
      <input type="hidden" name="videoId" value={videoId} />
      {state.message && (
        <div className={state.ok ? 'alert alert-success' : 'alert alert-error'} role="alert">
          {state.message}
        </div>
      )}
      <fieldset className="checklist">
        <legend>Verification checklist</legend>
        {MODERATION_CHECKLIST.map((c) => (
          <label className="check" key={c.key}>
            <input
              type="checkbox"
              name={`check_${c.key}`}
              checked={!!checked[c.key]}
              onChange={(e) => setChecked((s) => ({ ...s, [c.key]: e.target.checked }))}
            />
            {c.label}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="notes">Moderator notes (staff only)</label>
        <textarea
          id="notes"
          name="notes"
          maxLength={2000}
          rows={3}
          placeholder="Required when flagging or rejecting"
          aria-invalid={state.errors?.notes ? true : undefined}
        />
      </div>
      {publishHint && <p className="field-hint" style={{ marginTop: -6, marginBottom: 12 }}>{publishHint}</p>}
      <div className="action-row">
        <button
          className="btn btn-approve"
          type="submit"
          name="decision"
          value="approved"
          disabled={pending || !allChecked || !canPublish}
          title={!allChecked ? 'Complete every check to approve' : undefined}
        >
          ✓ Approve &amp; publish
        </button>
        <button className="btn btn-flag" type="submit" name="decision" value="flagged" disabled={pending}>
          ⚑ Flag for senior review
        </button>
        <button className="btn btn-ghost" type="submit" name="decision" value="rejected" disabled={pending}>
          ✕ Reject
        </button>
      </div>
    </form>
  )
}
