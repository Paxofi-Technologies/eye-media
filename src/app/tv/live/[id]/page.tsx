import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { z } from 'zod'
import { LiveEventCard } from '@/components/tv/LiveEventCard'
import { Player } from '@/components/tv/Player'
import { SchedulePanel } from '@/components/tv/Schedule'
import { formatClock, formatDate } from '@/lib/format'
import { playbackForEvent } from '@/lib/playback-server'
import { PHASE_LABELS, eventPhase, requestTime } from '@/lib/schedule'
import { getLiveEvent, getLiveEvents, getUpcomingEvents } from '@/lib/tv'

const load = cache(async (id: string) => (z.uuid().safeParse(id).success ? getLiveEvent(id) : null))

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const event = await load(id)
  if (!event) return { title: 'Broadcast not found' }
  return {
    title: event.title,
    description: event.description?.slice(0, 200) ?? undefined,
    alternates: { canonical: `/tv/live/${event.id}` },
  }
}

export default async function LiveEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await load(id)
  if (!event) notFound()

  const now = requestTime()
  const phase = eventPhase(event, now)
  const playback = playbackForEvent(event, { preview: false })
  const [liveEvents, upcoming] = await Promise.all([getLiveEvents(), getUpcomingEvents(6)])
  const otherLive = liveEvents.filter((e) => e.id !== event.id)

  return (
    <>
      <div className="wrap" style={{ paddingTop: 30 }}>
        <div className="hero-grid">
          <article>
            {phase === 'cancelled' ? (
              <div className="empty-state off-air">
                <h2>This broadcast was cancelled</h2>
                <p>
                  See the <Link href="/tv/schedule">live schedule</Link> for other upcoming broadcasts.
                </p>
              </div>
            ) : event.replaySlug && phase === 'ended' ? (
              <div className="empty-state off-air">
                <h2>This broadcast has ended</h2>
                <p>The full recording is in the archive.</p>
                <p style={{ marginTop: 14 }}>
                  <Link className="btn btn-primary" href={`/tv/${event.replaySlug}`}>
                    Watch the replay
                  </Link>
                </p>
              </div>
            ) : playback.kind !== 'none' ? (
              <Player source={playback} title={event.title} live={phase === 'live'} />
            ) : (
              <div className="empty-state off-air">
                <h2>{phase === 'ended' ? 'This broadcast has ended' : 'Not on air yet'}</h2>
                <p>
                  {phase === 'ended'
                    ? 'A replay will appear in the archive once the newsroom publishes it.'
                    : `Scheduled for ${formatClock(event.startsAt)} WAT on ${formatDate(event.startsAt)}.`}
                </p>
              </div>
            )}
            <div className="hero-copy">
              <div className="meta-row">
                <span className={phase === 'live' ? 'badge badge-live' : 'badge badge-verified'}>
                  {phase === 'live' && <span className="pulse" />}
                  {PHASE_LABELS[phase].toUpperCase()}
                </span>
                {event.categoryName && <span className="badge badge-cat">{event.categoryName}</span>}
                {event.city && <span className="badge badge-cat">{event.city}</span>}
              </div>
              <h1>{event.title}</h1>
              <p className="byline">
                <time dateTime={event.startsAt.toISOString()}>
                  {formatDate(event.startsAt)} · {formatClock(event.startsAt)} WAT
                </time>
                {event.venue && <> · {event.venue}</>}
              </p>
              {event.description && <p style={{ whiteSpace: 'pre-line' }}>{event.description}</p>}
            </div>
          </article>
          <SchedulePanel heading="Live & up next" slots={upcoming.filter((e) => e.id !== event.id)} now={now} />
        </div>
      </div>

      {otherLive.length > 0 && (
        <section className="wrap section-pad" aria-labelledby="other-live-h">
          <div className="section-head">
            <h2 id="other-live-h">Also live now</h2>
            <Link className="see-all" href="/tv/live">
              All live streams
            </Link>
          </div>
          <div className="grid-3">
            {otherLive.map((e, i) => (
              <LiveEventCard key={e.id} event={e} index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
