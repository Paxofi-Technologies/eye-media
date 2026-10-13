'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { recordAudit } from '@/lib/audit'
import { clientIp, createSession, hashIp, verifyPassword } from '@/lib/auth'
import { RateLimiter } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validation'

export type LoginState = { error: string | null; email: string }

const perIp = new RateLimiter(20, 15 * 60 * 1000)
const perEmail = new RateLimiter(5, 15 * 60 * 1000)

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : ''
  // Only same-site admin paths; blocks open redirects like //evil.com or /\evil.com.
  return /^\/admin(\/[A-Za-z0-9/_?=&.-]*)?$/.test(next) ? next : '/admin'
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: form.get('email'), password: form.get('password') })
  const email = typeof form.get('email') === 'string' ? String(form.get('email')).slice(0, 254) : ''
  if (!parsed.success) return { error: 'Enter your email and password.', email }

  const ipKey = hashIp(await clientIp())
  if (!perIp.hit(ipKey) || !perEmail.hit(parsed.data.email)) {
    return { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.', email }
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1)
  const ok = await verifyPassword(user?.active ? user.passwordHash : null, parsed.data.password)
  if (!user || !ok) return { error: 'Incorrect email or password.', email }

  perEmail.reset(parsed.data.email)
  await createSession(user.id)
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id))
  await recordAudit(user, 'auth.login', { type: 'user', id: user.id, label: user.email })
  redirect(safeNext(form.get('next')))
}
