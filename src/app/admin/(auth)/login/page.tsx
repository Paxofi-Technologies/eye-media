import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import '@/styles/admin.css'
import { Logo } from '@/components/Logo'
import { getCurrentUser } from '@/lib/auth'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Staff sign-in', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect('/admin')
  const { next } = await searchParams
  return (
    <div className="login-wrap">
      <div className="login-card">
        <Logo href="/tv" sub="ADMIN" label="Eye TV home" />
        <h1>Staff sign-in</h1>
        <p>For Eye Media editors, moderators and producers.</p>
        <LoginForm next={typeof next === 'string' ? next : '/admin'} />
        <p style={{ marginTop: 18, marginBottom: 0 }}>
          <Link href="/tv" className="link-btn">
            ← Back to Eye TV
          </Link>
        </p>
      </div>
    </div>
  )
}
