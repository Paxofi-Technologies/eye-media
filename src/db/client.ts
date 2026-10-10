import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

/** Creates a pool + Drizzle instance. Shared by the app and the CLI scripts. */
export function createDb(url: string, connectionLimit = 5) {
  const pool = mysql.createPool({
    uri: url,
    // Store and read every DATETIME as UTC regardless of the server's time zone.
    timezone: 'Z',
    connectionLimit,
    // Shared cPanel hosts cap connections per user; keep the pool small and recycle idle ones.
    maxIdle: connectionLimit,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    charset: 'utf8mb4_unicode_ci',
  })
  return { pool, db: drizzle({ client: pool, schema, mode: 'default' }) }
}

export type Db = ReturnType<typeof createDb>['db']
