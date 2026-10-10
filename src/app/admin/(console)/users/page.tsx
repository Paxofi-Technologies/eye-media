import type { Metadata } from 'next'
import { setUserActive } from '@/app/admin/actions'
import { CreateUserForm } from '@/components/admin/CreateUserForm'
import { Restricted } from '@/components/admin/Restricted'
import { listStaff } from '@/lib/admin'
import { requireStaff } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { ROLE_LABELS, can } from '@/lib/rbac'

export const metadata: Metadata = { title: 'Staff Users' }

export default async function UsersPage() {
  const user = await requireStaff()
  if (!can(user.role, 'users.manage')) {
    return <Restricted title="Administrator access required">Only administrators can manage staff accounts.</Restricted>
  }
  const staff = await listStaff()

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Staff Users</h1>
          <div className="sub">Who can sign in to Eye TV admin, and what their role allows.</div>
        </div>
      </div>
      <div className="two-col">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Last sign-in</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} style={s.active ? undefined : { opacity: 0.55 }}>
                  <td>
                    <div className="cell-title">{s.name}{!s.active && ' (deactivated)'}</div>
                    <div className="cell-sub">{s.email}{s.title ? ` · ${s.title}` : ''}</div>
                  </td>
                  <td>{ROLE_LABELS[s.role]}</td>
                  <td className="cell-sub">{s.lastLoginAt ? timeAgo(s.lastLoginAt) : 'Never'}</td>
                  <td>
                    {s.id !== user.id && (
                      <form action={setUserActive}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="active" value={s.active ? 'false' : 'true'} />
                        <button className="btn btn-ghost btn-sm" type="submit">
                          {s.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CreateUserForm />
      </div>
    </>
  )
}
