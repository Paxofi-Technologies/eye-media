import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { LiveEventActions } from '@/components/admin/LiveEventActions'
import { LiveEventForm } from '@/components/admin/LiveForms'
import { StreamPanel } from '@/components/admin/StreamPanel'
import { Restricted } from '@/components/admin/Restricted'
import { Player } from '@/components/tv/Player'
import { getLiveEventForStaff } from '@/lib/admin'
import { playbackForEvent } from '@/lib/playback-server'
import { requireStaff } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { can } from '@/lib/rbac'
import { getCategories, getScheduleCities } from '@/lib/tv'

export const metadata: Metadata = { title: 'Live event' }

export default async function LiveEventAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; error?: string }>
}) {
  const user = await requireStaff()
  if (!can(user.role, 'live.manage')) {
    return <Restricted title="Not available for your role">Ask an editor or media manager to manage live streams.</Restricted>
  }
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [event, categories, cities, sp] = await Promise.all([getLiveEventForStaff(id), getCategories(), getScheduleCities(), searchParams])
  if (!event) notFound()

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>{event.title}</h1>
          <div className="sub">
            <span className={`status-pill ${event.status === 'live' ? 'status-live' : 'status-draft'}`}>{event.status}</span> ·
            starts {formatDateTime(event.startsAt)} WAT
            {event.startedAt && <> · went live {formatDateTime(event.startedAt)}</>}
            {event.endedAt && <> · ended {formatDateTime(event.endedAt)}</>}
          </div>
        </div>
        <Link className="btn btn-ghost" href="/admin/live">
          ← All events
        </Link>
      </div>
      {sp.created && <div className="alert alert-success" role="status">Event scheduled. Point your encoder at the stream settings below, then press Go live when the broadcast starts.</div>}
      {sp.error && <div className="alert alert-error" role="alert">{sp.error.slice(0, 200)}</div>}
      <div className="two-col">
        <LiveEventForm initial={event} categories={categories} cities={cities} />
        <div>
          <div className="form-panel">
            <h2>Broadcast</h2>
            <Player source={playbackForEvent(event, { preview: true })} title={event.title} live={event.status === 'live'} />
            <div style={{ marginTop: 14 }}>
              <LiveEventActions event={event} canMakeReplay={can(user.role, 'video.edit')} back="detail" />
            </div>
            <p className="field-hint">
              Public page:{' '}
              <Link href={`/tv/live/${event.id}`} target="_blank">
                /tv/live/{event.id.slice(0, 8)}…
              </Link>
            </p>
          </div>
          <StreamPanel event={event} />
        </div>
      </div>
    </>
  )
}
