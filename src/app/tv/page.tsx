import Link from 'next/link'
import { Player } from '@/components/tv/Player'
import { playbackForVideo } from '@/lib/playback-server'
import { playbackForEvent } from '@/lib/playback-server'
import { SchedulePanel } from '@/components/tv/Schedule'
import { VerifiedBadge, VideoCard } from '@/components/tv/VideoCard'
import { requestTime } from '@/lib/schedule'
import { getCategoriesWithCounts, getEditorsPicks, getFeatured, getLatest, getLiveEvents, getUpcomingEvents } from '@/lib/tv'

export default async function TvHome() {
  const now = requestTime()
  const [liveEvents, featured, schedule, picks, categories] = await Promise.all([
    getLiveEvents(),
    getFeatured(),
    getUpcomingEvents(5),
    getEditorsPicks(8),
    getCategoriesWithCounts(),
  ])
  const live = liveEvents[0] ?? null
  const latest = await getLatest(4, live ? undefined : featured?.id)
  const lead = !live ? (featured ?? latest[0] ?? null) : null
  const latestList = lead && !featured ? latest.slice(1) : latest
  const [first, ...rest] = latestList

  return (
    <>
      <div className="wrap hero">
        <div className="hero-grid">
          <div>
            {live ? (
              <>
                <Player source={playbackForEvent(live, { preview: false })} title={live.title} live />
                <div className="hero-copy">
                  <div className="meta-row">
                    {live.categoryName && <span className="badge badge-cat">{live.categoryName}</span>}
                    <span className="badge badge-live">
                      <span className="pulse" />
                      LIVE NOW
                    </span>
                    {liveEvents.length > 1 && (
                      <Link className="badge badge-cat" href="/tv/live">
                        {liveEvents.length} streams live · watch all
                      </Link>
                    )}
                  </div>
                  <h1>
                    <Link href={`/tv/live/${live.id}`}>{live.title}</Link>
                  </h1>
                  {live.description && <p>{live.description}</p>}
                </div>
              </>
            ) : lead ? (
              <>
                <Player source={playbackForVideo(lead, { preview: false })} title={lead.title} />
                <div className="hero-copy">
                  <div className="meta-row">
                    {lead.categoryName && <span className="badge badge-cat">{lead.categoryName}</span>}
                    {lead.verified && <VerifiedBadge long />}
                  </div>
                  <h1>
                    <Link href={`/tv/${lead.slug}`}>{lead.title}</Link>
                  </h1>
                  {lead.summary && <p>{lead.summary}</p>}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h3>Eye TV is getting ready</h3>
                <p>Verified reports and live coverage will appear here as soon as the newsroom publishes them.</p>
              </div>
            )}
          </div>
          <div>
            <SchedulePanel heading="Live & up next" slots={schedule} now={now} />
          </div>
        </div>
      </div>

      {first && (
        <section className="wrap section-pad" aria-labelledby="latest-h">
          <div className="section-head">
            <h2 id="latest-h">Latest</h2>
            <Link className="see-all" href="/tv/archive">
              View archive
            </Link>
          </div>
          <div className="grid-feature">
            <VideoCard video={first} />
            <div className="side-list">
              {rest.map((v, i) => (
                <VideoCard key={v.id} video={v} index={i + 1} variant="side" />
              ))}
            </div>
          </div>
        </section>
      )}

      {picks.length > 0 && (
        <section className="wrap section-pad tight-top" aria-labelledby="picks-h">
          <div className="section-head">
            <h2 id="picks-h">Editor&apos;s picks</h2>
            <Link className="see-all" href="/tv/archive">
              View archive
            </Link>
          </div>
          <div className="scroll-row">
            {picks.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} />
            ))}
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="wrap section-pad tight-top" aria-labelledby="cats-h">
          <div className="section-head">
            <h2 id="cats-h">Browse by category</h2>
          </div>
          <div className="cat-grid">
            {categories.map((c) => (
              <Link key={c.id} className="cat-tile" href={`/tv/archive?category=${c.slug}&range=all`}>
                <span className="n">
                  {c.count} {c.count === 1 ? 'report' : 'reports'}
                </span>
                <span className="name">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
