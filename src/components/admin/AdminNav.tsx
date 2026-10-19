'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ICONS: Record<string, React.ReactNode> = {
  queue: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </>
  ),
  videos: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M9 21V9" />
    </>
  ),
  live: (
    <>
      <rect x="2" y="6" width="15" height="12" rx="2" />
      <path d="M22 8l-5 4 5 4V8z" />
    </>
  ),
  audit: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M1 21v-1a6 6 0 0112 0v1M17 11a3 3 0 100-6M23 21v-1a5 5 0 00-4-4.9" />
    </>
  ),
}

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number }

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav className="admin-nav" aria-label="Admin">
      {items.map((item) => {
        const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {ICONS[item.icon]}
            </svg>
            {item.label}
            {item.badge ? (
              <span className="badge-count" aria-label={`${item.badge} waiting`}>
                {item.badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
