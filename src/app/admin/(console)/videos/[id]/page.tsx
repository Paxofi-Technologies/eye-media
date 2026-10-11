import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { changeVideoStatus } from '@/app/admin/actions'
import { StatusPill } from '@/components/admin/StatusPill'
import { VideoForm } from '@/components/admin/VideoForm'
import { Player } from '@/components/tv/Player'
import type { VideoStatus } from '@/db/schema'
import { getModerationHistory, getSubmitterContact, getVideoForStaff } from '@/lib/admin'
import { requireStaff } from '@/lib/auth'
import { formatCount, formatDateTime } from '@/lib/format'
import { can } from '@/lib/rbac'
import { getCategories } from '@/lib/tv'

export const metadata: Metadata = { title: 'Edit video' }

function StatusButton({ id, status, label, className }: { id: string; status: VideoStatus; label: string; className: string }) {
  return (
    <form action={changeVideoStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`btn ${className}`} type="submit" style={{ width: '100%' }}>
        {label}
      </button>
    </form>
  )
}

export default async function EditVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; error?: string }>
}) {
  const user = await requireStaff()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const row = await getVideoForStaff(id)
  if (!row) notFound()
  const sp = await searchParams
  const v = row.video

  const [categories, history, contact] = await Promise.all([
    getCategories(),
    getModerationHistory(v.id),
    v.source === 'citizen' && can(user.role, 'submission.contact.view') ? getSubmitterContact(v.id) : null,
  ])
  const canEdit = can(user.role, 'video.edit')
  const canPublish = can(user.role, 'video.publish')
  const inQueue = v.status === 'pending' || v.status === 'flagged'

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>{v.title}</h1>
          <div className="sub">
            <StatusPill status={v.status} /> · {v.source === 'citizen' ? 'Citizen submission' : 'Staff video'} · updated{' '}
            {formatDateTime(v.updatedAt)}
          </div>
        </div>
        <Link className="btn btn-ghost" href="/admin/videos">
          ← Registry
        </Link>
      </div>

      {sp.created && <div className="alert alert-success" role="status">Draft created. Add the video and submit it for review when ready.</div>}
      {sp.error && <div className="alert alert-error" role="alert">{sp.error.slice(0, 200)}</div>}

      <div className="two-col">
        <VideoForm
          initial={{ ...v, slug: v.slug }}
          categories={categories}
          canEdit={canEdit}
        />

        <div>
          <div className="form-panel">
            <h2>Preview</h2>
            <Player youtubeId={v.providerRef} title={v.title} />
            {v.status === 'published' && (
              <p style={{ marginBottom: 0 }}>
                <Link className="link-btn" href={`/tv/${v.slug}`} target="_blank">
                  View on Eye TV ↗
                </Link>{' '}
                <span className="cell-sub">· {formatCount(v.viewCount)} views</span>
              </p>
            )}
          </div>

          <div className="form-panel">
            <h2>Publication</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inQueue && (
                <Link className="btn btn-ghost" href={`/admin?id=${v.id}`}>
                  Review in moderation queue
                </Link>
              )}
              {canEdit && (v.status === 'draft' || v.status === 'unpublished' || v.status === 'rejected') && (
                <StatusButton id={v.id} status="pending" label="Submit for review" className="btn-ghost" />
              )}
              {canPublish && v.status !== 'published' && !inQueue && (
                <StatusButton id={v.id} status="published" label="Publish now" className="btn-approve" />
              )}
              {canPublish && v.status === 'published' && (
                <StatusButton id={v.id} status="unpublished" label="Unpublish" className="btn-ghost" />
              )}
              {canEdit && v.status === 'pending' && (
                <StatusButton id={v.id} status="draft" label="Move back to draft" className="btn-ghost" />
              )}
            </div>
            {!canPublish && <p className="field-hint">An editor must approve this video before it goes live.</p>}
          </div>

          {contact && (
            <div className="form-panel">
              <h2>Submitter · confidential</h2>
              <div className="kv-row"><span className="k">Reference</span><span className="v">{contact.reference}</span></div>
              <div className="kv-row"><span className="k">Name</span><span className="v">{contact.name}</span></div>
              {contact.email && <div className="kv-row"><span className="k">Email</span><span className="v">{contact.email}</span></div>}
              {contact.phone && <div className="kv-row"><span className="k">Phone</span><span className="v">{contact.phone}</span></div>}
              {v.submittedMediaUrl && (
                <div className="kv-row">
                  <span className="k">Link</span>
                  <span className="v">
                    <a href={v.submittedMediaUrl} target="_blank" rel="noopener noreferrer nofollow">{v.submittedMediaUrl}</a>
                  </span>
                </div>
              )}
            </div>
          )}

          {history.length > 0 && (
            <div className="form-panel history" style={{ marginTop: 16 }}>
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
        </div>
      </div>
    </>
  )
}
