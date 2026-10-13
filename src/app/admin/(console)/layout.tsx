import type { Metadata } from 'next'
import Link from 'next/link'
import '@/styles/admin.css'
import { AdminNav, type NavItem } from '@/components/admin/AdminNav'
import { Logo } from '@/components/Logo'
import { getQueueCount } from '@/lib/admin'
import { requireStaff } from '@/lib/auth'
import { initials } from '@/lib/format'
import { ROLE_LABELS, can } from '@/lib/rbac'
import { logout } from '../actions'

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Eye TV Admin' }, robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff()
  const queueCount = can(user.role, 'queue.view') ? await getQueueCount() : 0

  const items: NavItem[] = [
    { href: '/admin', label: 'Moderation Queue', icon: 'queue', badge: queueCount },
    { href: '/admin/videos', label: 'Video Registry', icon: 'videos' },
  ]
  if (can(user.role, 'live.manage')) items.push({ href: '/admin/live', label: 'Live & Schedule', icon: 'live' })
  if (can(user.role, 'audit.view')) items.push({ href: '/admin/audit', label: 'Audit & History', icon: 'audit' })
  if (can(user.role, 'users.manage')) items.push({ href: '/admin/users', label: 'Staff Users', icon: 'users' })

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Logo href="/admin" sub="ADMIN" label="Eye TV admin home" />
        <AdminNav items={items} />
        <div className="sidebar-foot">
          <div className="who">
            <div className="avatar" aria-hidden="true">
              {initials(user.name)}
            </div>
            <div>
              <div className="name">{user.name}</div>
              <div className="role">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
          <Link className="link-btn" href="/tv">
            ← Public site
          </Link>
          <form action={logout}>
            <button className="link-btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="admin-main" id="main">
        {children}
      </main>
    </div>
  )
}
