import type { Metadata } from 'next'
import Link from 'next/link'
import { z } from 'zod'
import { Restricted } from '@/components/admin/Restricted'
import { Pagination } from '@/components/Pagination'
import { AUDIT_PAGE_SIZE, listAudit, listStaff } from '@/lib/admin'
import { AUDIT_LABELS, type AuditAction } from '@/lib/audit'
import { requireStaff } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { parsePage } from '@/lib/pagination'
import { can } from '@/lib/rbac'

export const metadata: Metadata = { title: 'Audit & History' }

type Search = { actor?: string; action?: string; q?: string; page?: string }

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireStaff()
  if (!can(user.role, 'audit.view')) {
    return <Restricted title="Editor access required">Only editors and administrators can view the audit trail.</Restricted>
  }
  const sp = await searchParams
  const actorId = z.uuid().safeParse(sp.actor).success ? sp.actor! : null
  const action = sp.action && sp.action in AUDIT_LABELS ? sp.action : null
  const q = (sp.q ?? '').slice(0, 100)
  const page = parsePage(sp.page)

  const [{ rows, total }, staff] = await Promise.all([listAudit({ actorId, action, q, page }), listStaff()])
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE))
  const href = (p: number) => {
    const params = new URLSearchParams()
    if (actorId) params.set('actor', actorId)
    if (action) params.set('action', action)
    if (q) params.set('q', q)
    params.set('page', String(p))
    return `/admin/audit?${params}`
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Audit &amp; History</h1>
          <div className="sub">Every moderation decision, publish, edit and sign-in — who did it and when.</div>
        </div>
      </div>
      <form className="table-toolbar" method="get" action="/admin/audit">
        <label className="visually-hidden" htmlFor="aa">Actor</label>
        <select id="aa" name="actor" defaultValue={actorId ?? ''}>
          <option value="">All actors</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="ac">Action</label>
        <select id="ac" name="action" defaultValue={action ?? ''}>
          <option value="">All actions</option>
          {Object.entries(AUDIT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="aq">Search</label>
        <input id="aq" type="search" name="q" defaultValue={q} placeholder="Search audit log…" maxLength={100} />
        <button className="btn btn-ghost btn-sm" type="submit">Filter</button>
      </form>
      {rows.length === 0 ? (
        <div className="empty-state"><h3>No matching activity</h3><p>Try clearing the filters.</p></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-sub" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.createdAt)}</td>
                  <td>{r.actorName}</td>
                  <td>{AUDIT_LABELS[r.action as AuditAction] ?? r.action}</td>
                  <td>
                    {r.targetType === 'video' && r.targetId ? (
                      <Link href={`/admin/videos/${r.targetId}`}>{r.targetLabel ?? r.targetId}</Link>
                    ) : (
                      r.targetLabel ?? '—'
                    )}
                  </td>
                  <td className="cell-sub">{r.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} href={href} label="Audit log pages" />
      {total > 0 && (
        <p className="cell-sub" style={{ textAlign: 'center', marginTop: 10 }}>
          Showing {(page - 1) * AUDIT_PAGE_SIZE + 1}–{Math.min(page * AUDIT_PAGE_SIZE, total)} of {total}
        </p>
      )}
    </>
  )
}
