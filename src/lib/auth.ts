import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes } from 'node:crypto'
import { verify } from '@node-rs/argon2'
import { and, eq, gt, lt } from 'drizzle-orm'
import { db, schema } from '@/db'
import { hashPassword } from './password'
import { can, type Permission } from './rbac'
import type { User } from '@/db/schema'

// Secure cookies whenever the public URL is HTTPS (always the case in production).
const SECURE = (process.env.SITE_URL ?? '').startsWith('https://')
// __Host- prefix pins the cookie to this exact origin over HTTPS (no Domain, Path=/).
export const SESSION_COOKIE = SECURE ? '__Host-eye_session' : 'eye_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

export { hashPassword }

// Pre-computed hash used to keep login timing uniform when the email does not exist.
let dummyHash: Promise<string> | null = null
export async function verifyPassword(passwordHash: string | null, password: string) {
  if (!passwordHash) {
    dummyHash ??= hashPassword('timing-equaliser-not-a-real-password')
    await verify(await dummyHash, password).catch(() => false)
    return false
  }
  return verify(passwordHash, password).catch(() => false)
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt })
  // Opportunistic cleanup of expired sessions.
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()))
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)))
  jar.delete(SESSION_COOKIE)
}

export type SessionUser = Pick<User, 'id' | 'email' | 'name' | 'title' | 'role'>

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token || token.length > 100) return null
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      title: schema.users.title,
      role: schema.users.role,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.id, sha256(token)),
        gt(schema.sessions.expiresAt, new Date()),
        eq(schema.users.active, true),
      ),
    )
    .limit(1)
  return rows[0] ?? null
})

/** For admin pages: redirects to login when signed out. Returns the user and whether they hold `permission`. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  return user
}

export class AuthzError extends Error {}

/** For server actions: throws unless the caller is signed in and holds `permission`. */
export async function authorize(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user || !can(user.role, permission)) throw new AuthzError('Not authorised')
  return user
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  // Only trustworthy when the app runs behind a reverse proxy that sets these headers.
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

export function hashIp(ip: string) {
  return createHash('sha256')
    .update(`${process.env.IP_HASH_SECRET ?? ''}:${ip}`)
    .digest('hex')
}
