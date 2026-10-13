import { createReplayFromEvent, deleteLiveEvent, setLiveEventStatus } from '@/app/admin/actions'
import type { LiveEventStatus } from '@/db/schema'

function StatusButton({ id, status, label, className, back }: { id: string; status: LiveEventStatus; label: string; className: string; back?: 'detail' }) {
  return (
    <form action={setLiveEventStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      {back && <input type="hidden" name="back" value={back} />}
      <button className={`btn btn-sm ${className}`} type="submit">
        {label}
      </button>
    </form>
  )
}

/** The status transitions available for an event, as small forms (work without JavaScript). */
export function LiveEventActions({
  event,
  canMakeReplay,
  back,
}: {
  event: { id: string; status: LiveEventStatus; recordingAssetId: string | null; providerRef: string | null; startedAt: Date | null; replayVideoId: string | null }
  canMakeReplay: boolean
  back?: 'detail'
}) {
  const { id, status } = event
  return (
    <div className="action-row" style={{ gap: 6 }}>
      {(status === 'scheduled' || status === 'ended') && (
        <StatusButton id={id} status="live" label={status === 'ended' ? 'Resume live' : 'Go live'} className="btn-primary" back={back} />
      )}
      {status === 'live' && <StatusButton id={id} status="ended" label="End stream" className="btn-ghost" back={back} />}
      {status === 'scheduled' && <StatusButton id={id} status="cancelled" label="Cancel" className="btn-ghost" back={back} />}
      {status === 'cancelled' && <StatusButton id={id} status="scheduled" label="Reschedule" className="btn-ghost" back={back} />}
      {status === 'ended' && canMakeReplay && (event.recordingAssetId || event.providerRef) && (
        <form action={createReplayFromEvent}>
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-sm btn-approve" type="submit">
            {event.replayVideoId ? 'Open replay' : 'Create replay'}
          </button>
        </form>
      )}
      {back === 'detail' && !event.startedAt && status !== 'live' && (
        <form action={deleteLiveEvent}>
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-sm btn-ghost" type="submit">
            Delete
          </button>
        </form>
      )}
    </div>
  )
}
