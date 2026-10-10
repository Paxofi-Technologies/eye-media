import type { Metadata } from 'next'
import Link from 'next/link'
import { Player } from '@/components/tv/Player'
import { SchedulePanel } from '@/components/tv/Schedule'
import { VideoCard } from '@/components/tv/VideoCard'
import { formatClock } from '@/lib/format'
import { getLatest, getLiveStream, getUpcomingSchedule } from '@/lib/tv'

export const metadata: Metadata = {
  title: 'Live',
  description: 'Watch Eye TV live coverage from Lagos and see what is coming up next.',
  alternates: { canonical: '/tv/live' },
}

export default async function LivePage() {
  const [live, schedule, recent] = await Promise.all([getLiveStream(), getUpcomingSchedule(6), getLatest(6)])

  return (
    <>
      <div className="wrap" style={{ paddingTop: 30 }}>
        <div className="hero-grid">
          <div>
            {live ? (
              <>
                <Player youtubeId={live.youtubeVideoId} title={live.title} live />
                <div className="hero-copy">
                  <div className="meta-row">
                    {live.categoryName && <span className="badge badge-cat">{live.categoryName}</span>}
                    {live.startedAt && <span className="byline">Streaming since {formatClock(live.startedAt)}</span>}
                  </div>
                  <h1>{live.title}</h1>
                  {live.description && <p>{live.description}</p>}
                  <p className="byline">
                    Live coverage is produced by Eye Media staff under our{' '}
                    <Link href="/tv/editorial-policy">editorial policy</Link>.
                  </p>
                </div>
              </>
            ) : (
              <div
                className="empty-state"
                style={{ aspectRatio: '16 / 9', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
              >
                <h1 style={{ fontSize: '1.2rem', margin: '0 0 8px' }}>We&apos;re off air right now</h1>
                <p>Check the schedule for our next live broadcast, or catch up on recent verified reports below.</p>
              </div>
            )}
          </div>
          <SchedulePanel heading="Today's schedule" slots={schedule} liveTitle={live?.title} />
        </div>
      </div>

      {recent.length > 0 && (
        <section className="wrap section-pad" aria-labelledby="recent-h">
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
