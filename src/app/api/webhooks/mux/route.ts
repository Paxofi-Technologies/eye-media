import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, schema } from '@/db'
import { handleMuxEvent } from '@/lib/mux-webhook'
import { verifyWebhookSignature } from '@/lib/mux-security'

export const dynamic = 'force-dynamic'

/** Opening the address in a browser: confirms the route exists and the secret is set (Mux itself only POSTs). */
export async function GET() {
  return Response.json(
    { endpoint: 'mux-webhook', accepts: 'POST', secretConfigured: Boolean(process.env.MUX_WEBHOOK_SECRET?.trim()) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(req: Request) {
  const secret = process.env.MUX_WEBHOOK_SECRET?.trim()
  if (!secret) return Response.json({ error: 'Webhook not configured.' }, { status: 503 })

  const raw = await req.text()
  if (raw.length > 1_000_000) return Response.json({ error: 'Too large.' }, { status: 413 })
  const check = verifyWebhookSignature(raw, req.headers.get('mux-signature'), secret)
  if (!check.ok) return Response.json({ error: 'Invalid signature.' }, { status: 401 })

  let event: { id?: string; type?: string; data?: { id?: string } }
  try {
    event = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'Bad JSON.' }, { status: 400 })
  }
  if (!event.id || !event.type) return Response.json({ error: 'Bad event.' }, { status: 400 })

  // Mux retries and may deliver twice: process each event id once.
  try {
    await db.insert(schema.muxEvents).values({ id: event.id, type: event.type, objectId: event.data?.id ?? null })
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code
    if (code === 'ER_DUP_ENTRY') return Response.json({ ok: true, duplicate: true })
    throw e
  }

  try {
    await handleMuxEvent(event as Parameters<typeof handleMuxEvent>[0])
    await db.update(schema.muxEvents).set({ processedAt: new Date() }).where(eq(schema.muxEvents.id, event.id))
    revalidatePath('/admin', 'layout')
    if (event.type.startsWith('video.live_stream') || event.type.includes('live_stream_completed')) {
      revalidatePath('/tv', 'layout')
    }
  } catch (e) {
    // Let Mux retry: forget the event id and say so.
    await db
      .update(schema.muxEvents)
      .set({ error: (e instanceof Error ? e.message : 'error').slice(0, 500) })
      .where(eq(schema.muxEvents.id, event.id))
    await db.delete(schema.muxEvents).where(eq(schema.muxEvents.id, event.id))
    return Response.json({ error: 'Processing failed.' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
