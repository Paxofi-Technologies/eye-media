import 'dotenv/config'
import path from 'node:path'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { createDb } from '../src/db/client'

/** Applies pending SQL migrations. Also bundled into the cPanel release and run on every deploy. */
export async function runMigrations(url: string, migrationsFolder: string = defaultMigrationsDir()) {
  const { db, pool } = createDb(url, 1)
  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await pool.end()
  }
}

/** `drizzle/` next to the scripts folder: repo root in dev, `server/` in the cPanel release. */
export function defaultMigrationsDir() {
  return process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, '..', 'drizzle')
}

/** Drizzle wraps driver errors as "Failed query: …"; surface the underlying MySQL reason too. */
export function describeError(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err
  for (let depth = 0; current && depth < 4; depth++) {
    if (current instanceof Error) {
      const code = (current as { code?: string }).code
      // Skip the bound parameters Drizzle appends: they can contain password hashes.
      parts.push((code ? `[${code}] ` : '') + current.message.split('\nparams:')[0])
      current = current.cause
    } else {
      parts.push(String(current))
      break
    }
  }
  return parts.join('\n  caused by: ')
}

if (process.argv[1] && /migrate\.(ts|cjs|js)$/.test(process.argv[1])) {
  runMigrations(process.env.DATABASE_URL!)
    .then(() => console.log('Migrations applied.'))
    .catch((err) => {
      console.error(describeError(err))
      process.exit(1)
    })
}
