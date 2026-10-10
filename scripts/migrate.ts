import 'dotenv/config'
import path from 'node:path'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { createDb } from '../src/db/client'

/** Applies pending SQL migrations. Also bundled into the cPanel release and run on every deploy. */
export async function runMigrations(url: string, migrationsFolder: string) {
  const { db, pool } = createDb(url, 1)
  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await pool.end()
  }
}

if (process.argv[1] && /migrate\.(ts|cjs|js)$/.test(process.argv[1])) {
  const folder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle')
  runMigrations(process.env.DATABASE_URL!, folder)
    .then(() => console.log('Migrations applied.'))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
