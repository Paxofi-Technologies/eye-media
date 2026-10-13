import type { Metadata } from 'next'
import Link from 'next/link'
import { LiveEventCard } from '@/components/tv/LiveEventCard'
import { Player } from '@/components/tv/Player'
import { SchedulePanel } from '@/components/tv/Schedule'
import { VideoCard } from '@/components/tv/VideoCard'
import { playbackForEvent } from '@/lib/playback-server'
import { formatClock } from '@/lib/format'
import { requestTime } from '@/lib/schedule'
import { getLatest, getLiveEvents, getUpcomingEvents } from '@/lib/tv'

export const metadata: Metadata = {
  title: 'Live',
  description: 'Watch every Eye TV live stream that is on air now, and see what is coming up next.',
  alternates: { canonical: '/tv/live' },
}

export default async function LivePage() {
  const now = requestTime()
  const [liveEvents, upcoming, recent] = await Promise.all([getLiveEvents(), getUpcomingEvents(6), getLatest(6)])
  const [main, ...others] = liveEvents

  return (
    <>
      <div className="wrap" style={{ paddingTop: 30 }}>
        <div className="hero-grid">
          <div>
            {main ? (
              <>
                <Player source={playbackForEvent(main, { preview: false })} title={main.title} live />
                <div className="hero-copy">
                  <div className="meta-row">
                    {main.categoryName && <span className="badge badge-cat">{main.categoryName}</span>}
                    {main.city && <span className="badge badge-cat">{main.city}</span>}
                    {main.startedAt && <span className="byline">On air since {formatClock(main.startedAt)}</span>}
                  </div>
                  <h1>
                    <Link href={`/tv/live/${main.id}`}>{main.title}</Link>
                  </h1>
                  {main.description && <p>{main.description}</p>}
                  <p className="byline">
                    Live coverage is produced by Eye Media staff under our{' '}
                    <Link href="/tv/editorial-policy">editorial policy</Link>.
                  </p>
                </div>
              </>
            ) : (
              <div className="empty-state off-air">
                <h1>We&apos;re off air right now</h1>
                <p>
                  See the <Link href="/tv/schedule">live schedule</Link> for our next broadcast, or catch up on recent
                  verified reports below.
                </p>
              </div>
            )}
          </div>
          <SchedulePanel heading="Live & up next" slots={upcoming} now={now} />
        </div>
      </div>

      {others.length > 0 && (
        <section className="wrap section-pad" aria-labelledby="also-live-h">
          <div className="section-head">
            <h2 id="also-live-h">Also live now · {others.length + 1} streams on air</h2>
            <Link className="see-all" href="/tv/schedule">
              Full schedule
            </Link>
          </div>
          <div className="grid-3">
            {others.map((e, i) => (
              <LiveEventCard key={e.id} event={e} index={i} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className={others.length ? 'wrap section-pad tight-top' : 'wrap section-pad'} aria-labelledby="recent-h">
          <div className="section-head">
            <h2 id="recent-h">Catch up</h2>
            <Link className="see-all" href="/tv/archive">
              View archive
            </Link>
          </div>
          <div className="grid-3">
            {recent.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
