import 'server-only'

/** Same-origin check for state-changing API routes (cookies are SameSite=Lax, this is defence in depth). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error: message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } })
}
