import { createLiveStreamAction, removeSimulcast } from '@/app/admin/actions'
import { SimulcastForm, StreamKey } from '@/components/admin/StreamControls'
import { MuxError, RTMPS_URL, RTMP_URL, getLiveStream, muxReady, type MuxLiveStream } from '@/lib/mux'

const KIND_LABEL: Record<string, string> = { youtube: 'YouTube', facebook: 'Facebook', custom: 'Custom RTMP' }

/** Encoder settings, live connection state and simulcast destinations for an event's Mux stream. */
export async function StreamPanel({ event }: { event: { id: string; status: string; muxLiveStreamId: string | null } }) {
  if (!event.muxLiveStreamId) {
    return (
      <div className="form-panel">
        <h2>Stream</h2>
        {muxReady() ? (
          <p className="field-hint">This event has no stream yet.</p>
        ) : (
          <div className="alert alert-error" role="alert">
            Mux is not connected. Add the Mux settings in cPanel (see the Mux setup guide), restart the app, then create the stream.
          </div>
        )}
        <form action={createLiveStreamAction}>
          <input type="hidden" name="id" value={event.id} />
          <button className="btn btn-primary btn-sm" type="submit" disabled={!muxReady()}>
            Create stream
          </button>
        </form>
      </div>
    )
  }

  let stream: MuxLiveStream | null = null
  let problem: string | null = null
  try {
    stream = await getLiveStream(event.muxLiveStreamId)
  } catch (e) {
    problem = e instanceof MuxError ? e.message : 'Could not read the stream from Mux.'
  }
  const connected = stream?.status === 'active'
  const targets = stream?.simulcast_targets ?? []

  return (
    <div className="form-panel">
      <h2>Stream</h2>
      {problem && <div className="alert alert-error" role="alert">{problem}</div>}
      {stream && (
        <p>
          Encoder:{' '}
          <span className={`status-pill ${connected ? 'status-live' : 'status-draft'}`} data-testid="encoder-status">
            {connected ? 'receiving video' : 'not connected'}
          </span>
        </p>
      )}
      <div className="field">
        <span className="label">Server (RTMPS, recommended)</span>
        <code className="stream-secret">{RTMPS_URL}</code>
      </div>
      <div className="field">
        <span className="label">Server (RTMP, if your encoder has no RTMPS)</span>
        <code className="stream-secret">{RTMP_URL}</code>
      </div>
      <StreamKey eventId={event.id} live={event.status === 'live'} />

      <h3 style={{ marginTop: 20 }}>Also stream to</h3>
      {targets.length === 0 ? (
        <p className="field-hint">No extra destinations. Optional: send a copy to YouTube or Facebook.</p>
      ) : (
        <ul className="plain-list">
          {targets.map((t) => (
            <li key={t.id} className="action-row" style={{ gap: 8, justifyContent: 'space-between' }}>
              <span>
                {KIND_LABEL[t.passthrough ?? 'custom'] ?? 'Custom RTMP'} <span className="field-hint">({t.status})</span>
              </span>
              <form action={removeSimulcast}>
                <input type="hidden" name="id" value={event.id} />
                <input type="hidden" name="targetId" value={t.id} />
                <button className="btn btn-sm btn-ghost" type="submit">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <SimulcastForm eventId={event.id} />
    </div>
  )
}
