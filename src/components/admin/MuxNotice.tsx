import { muxStatus } from '@/lib/mux'

/** Tells staff exactly which Mux settings are missing on this server (names only, never values). */
export function MuxNotice() {
  const s = muxStatus()
  const missing: string[] = []
  if (!s.api) missing.push('MUX_TOKEN_ID and MUX_TOKEN_SECRET')
  if (!s.signing) missing.push('MUX_SIGNING_KEY_ID and MUX_SIGNING_KEY_PRIVATE')
  if (!s.webhook) missing.push('MUX_WEBHOOK_SECRET')
  if (missing.length === 0) return null
  return (
    <div className="alert alert-error" role="alert">
      Mux is not fully connected on this server. Missing: {missing.join('; ')}. Add them in cPanel → Setup Node.js App, click
      Save, then Restart. Until then video upload{!s.webhook ? ', processing updates' : ''} and live streaming do not work.
    </div>
  )
}
