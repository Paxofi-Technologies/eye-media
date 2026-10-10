/* eslint-disable @next/next/no-img-element -- thumbnails are served by YouTube's image CDN */
import type { Metadata } from 'next'
import Link from 'next/link'
import { z } from 'zod'
import { Restricted } from '@/components/admin/Restricted'
import { ReviewForm } from '@/components/admin/ReviewForm'
import { StatusPill } from '@/components/admin/StatusPill'
import { Player } from '@/components/tv/Player'
import { thumbnailFor } from '@/components/tv/Thumb'
import { getModerationHistory, getQueue, getSubmitterContact, getVideoForStaff } from '@/lib/admin'
import { requireStaff } from '@/lib/auth'
import { formatDateTime, formatDuration, timeAgo } from '@/lib/format'
import { can } from '@/lib/rbac'

export const metadata: Metadata = { title: 'Moderation Queue' }

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireStaff()

  const header = (
    <div className="admin-topbar">
      <div>
        <h1>Moderation Queue</h1>
        <div className="sub">Review citizen submissions and reporter uploads before they publish to Eye TV.</div>
      </div>
    </div>
  )

  if (!can(user.role, 'queue.view')) {
    return (
      <>
        {header}
        <Restricted title="Editor access required">
          Your role can create and track videos in the <Link href="/admin/videos">Video Registry</Link>, but only
          editors and moderators can review and publish the moderation queue.
        </Restricted>
      </>
    )
  }

  const queue = await getQueue()
  const { id } = await searchParams
  const selectedId = z.uuid().safeParse(id).success ? id! : queue[0]?.id
  const selected = selectedId ? await getVideoForStaff(selectedId) : null

  if (queue.length === 0 && !selected) {
    return (
      <>
        {header}
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          <h3>Queue is clear</h3>
          <p>Nothing is waiting on review. New citizen submissions and reporter uploads land here automatically.</p>
        </div>
      </>
    )
  }

  const [contact, history] = selected
    ? await Promise.all([
        can(user.role, 'submission.contact.view') ? getSubmitterContact(selected.video.id) : null,
        getModerationHistory(selected.video.id),
      ])
    : [null, []]
  const v = selected?.video
  const inQueue = v && (v.status === 'pending' || v.status === 'flagged')

  return (
    <>
      {header}
      <div className="q-layout">
        <div className="q-list" role="list" aria-label="Items awaiting review">
          {queue.map((q) => {
            const thumb = thumbnailFor(q)
            return (
              <Link
                role="listitem"
                key={q.id}
                className="q-item"
                href={`/admin?id=${q.id}`}
                aria-current={q.id === selectedId ? 'true' : undefined}
              >
                <div className="qthumb">{thumb && <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />}</div>
                <div>
                  <h2>{q.title}</h2>
                  <div className="qmeta">
                    {q.source === 'citizen' ? 'Citizen submission' : q.reporterName} · {q.categoryName ?? 'Uncategorised'} ·{' '}
                    {timeAgo(q.createdAt)}
                  </div>
                  <StatusPill status={q.status} extra={q.sensitive ? 'Sensitive' : undefined} />
                </div>
              </Link>
            )
          })}
        </div>

        {v && selected ? (
          <section className="review-panel" aria-label="Review">
            <Player youtubeId={v.providerRef} title={v.title} />
            <h2>{v.title}</h2>
            <div className="kv-row">
              <span className="k">Status</span>
              <span className="v">
                <StatusPill status={v.status} />
              </span>
            </div>
            <div className="kv-row">
              <span className="k">Submitted by</span>
              <span className="v">
                {v.source === 'citizen' ? `${v.reporterName ?? 'Anonymous'} (citizen, unverified)` : (selected.reporterAccountName ?? v.reporterName)}
              </span>
            </div>
            <div className="kv-row">
              <span className="k">Category</span>
              <span className="v">{selected.categoryName ?? '—'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Location</span>
              <span className="v">{v.location ?? '—'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Duration</span>
              <span className="v">{formatDuration(v.durationSeconds) ?? '—'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Received</span>
              <span className="v">{formatDateTime(v.createdAt)}</span>
            </div>
            {v.submittedMediaUrl && (
              <div className="kv-row">
                <span className="k">Submitted link</span>
                <span className="v">
                  <a href={v.submittedMediaUrl} target="_blank" rel="noopener noreferrer nofollow">
                    {v.submittedMediaUrl}
                  </a>{' '}
                  <span className="cell-sub">— external, unverified link: open with care</span>
                </span>
              </div>
            )}
            {contact && (
              <div className="pii-box">
                <div className="t">Submitter contact · confidential</div>
                <div className="kv-row"><span className="k">Reference</span><span className="v">{contact.reference}</span></div>
                <div className="kv-row"><span className="k">Name</span><span className="v">{contact.name}</span></div>
                {contact.email && <div className="kv-row"><span className="k">Email</span><span className="v">{contact.email}</span></div>}
                {contact.phone && <div className="kv-row"><span className="k">Phone</span><span className="v">{contact.phone}</span></div>}
              </div>
            )}
            {v.description && <p className="review-desc">{v.description}</p>}

            {inQueue && can(user.role, 'queue.moderate') ? (
              <ReviewForm
                key={v.id}
                videoId={v.id}
                canPublish={!!v.providerRef && !!v.categoryId}
                publishHint={
                  !v.providerRef
                    ? 'Before approving, upload the footage to the Eye TV YouTube channel and attach it via "Edit video".'
                    : null
                }
              />
            ) : (
              <p className="field-hint">This item is no longer in the queue.</p>
            )}
            {can(user.role, 'video.edit') && (
              <p style={{ marginTop: 14 }}>
                <Link className="btn btn-ghost btn-sm" href={`/admin/videos/${v.id}`}>
                  Edit video
                </Link>
              </p>
            )}
            {history.length > 0 && (
              <div className="history">
                <h3>Review history</h3>
                <ul>
                  {history.map((h) => (
                    <li key={h.id}>
                      <strong>{h.reviewerName ?? 'Former staff'}</strong> {h.decision} · {formatDateTime(h.createdAt)}
                      {h.notes && <> — {h.notes}</>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </>
  )
}
