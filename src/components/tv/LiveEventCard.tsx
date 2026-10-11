import Link from 'next/link'
import type { PublicLiveEvent } from '@/lib/tv'
import { Thumb } from './Thumb'

/** Card for a stream that is on air right now. */
export function LiveEventCard({ event, index = 0 }: { event: PublicLiveEvent; index?: number }) {
  return (
    <Link className="card live-card" href={`/tv/live/${event.id}`}>
      <div className="live-card-media">
        <Thumb video={{ providerRef: event.providerRef }} alt={index % 2 === 1} />
        <span className="badge badge-live live-card-badge">
          <span className="pulse" />
          LIVE
        </span>
      </div>
      <div className="meta-row">
        {event.categoryName && <span className="badge badge-cat">{event.categoryName}</span>}
        {event.city && <span className="byline">{event.city}</span>}
      </div>
      <h3>{event.title}</h3>
    </Link>
  )
}
