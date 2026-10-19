'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/tv', label: 'Home' },
  { href: '/tv/live', label: 'Live' },
  { href: '/tv/schedule', label: 'Schedule' },
  { href: '/tv/archive', label: 'Archive' },
]

export function NavLinks() {
  const pathname = usePathname()
  return (
    <nav className="primary" aria-label="Eye TV">
      {LINKS.map((l) => {
        const active = l.href === '/tv' ? pathname === '/tv' : pathname.startsWith(l.href)
        return (
          <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined}>
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
