import { sql } from 'drizzle-orm'
import { db } from '@/db'

export const dynamic = 'force-dynamic'

// Liveness + database readiness probe for uptime monitoring (NFR-03).
export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ status: 'degraded' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
