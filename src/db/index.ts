import 'server-only'
import { createDb } from './client'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

// Reuse the connection pool across hot reloads in development.
const globalForDb = globalThis as unknown as { eyeDb?: ReturnType<typeof createDb> }
const conn = globalForDb.eyeDb ?? createDb(url, Number(process.env.DB_POOL_SIZE ?? 5))
if (process.env.NODE_ENV !== 'production') globalForDb.eyeDb = conn

export const db = conn.db
export { schema }
