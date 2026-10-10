/**
 * Creates (or resets the password of) a staff account. Use this to bootstrap the first production admin:
 *
 *   npm run user:create -- --email you@eyemedia.ng --name "Your Name" --role admin
 *
 * On cPanel without SSH: set EYE_ADMIN_EMAIL and EYE_ADMIN_NAME in Setup Node.js App, then use
 * "Run JS script" → eyetv:create-admin. Remove those variables afterwards.
 *
 * The password is read from the EYE_NEW_PASSWORD environment variable so it never lands in shell history
 * as an argument; if unset, a strong random password is generated and printed once.
 */
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { createDb } from '../src/db/client'
import * as schema from '../src/db/schema'
import { hashPassword } from '../src/lib/password'
import { createUserSchema } from '../src/lib/validation'

async function main() {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'admin' }, title: { type: 'string' } },
  })
  const generated = !process.env.EYE_NEW_PASSWORD
  const password = process.env.EYE_NEW_PASSWORD ?? randomBytes(18).toString('base64url')
  const parsed = createUserSchema.parse({
    email: values.email ?? process.env.EYE_ADMIN_EMAIL,
    name: values.name ?? process.env.EYE_ADMIN_NAME,
    role: values.role,
    title: values.title ?? '',
    password,
  })

  const { db, pool } = createDb(process.env.DATABASE_URL!, 1)
  const passwordHash = await hashPassword(parsed.password)
  await db
    .insert(schema.users)
    .values({ email: parsed.email, name: parsed.name, title: parsed.title, role: parsed.role, passwordHash })
    .onDuplicateKeyUpdate({ set: { passwordHash, role: parsed.role, active: true, updatedAt: new Date() } })
  await pool.end()

  console.log(`User ${parsed.email} (${parsed.role}) is ready.`)
  if (generated) console.log(`Temporary password (shown once): ${password}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
