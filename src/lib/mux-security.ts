import 'server-only'
import { createHmac, createSign, timingSafeEqual } from 'node:crypto'

/* ------------------------------------------------------------------ */
/* Signed playback tokens (JWT, RS256)                                  */
/* ------------------------------------------------------------------ */

// Token audiences defined by Mux: v = video, t = thumbnail, s = storyboard.
export type TokenAudience = 'v' | 't' | 's'

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url')

/** Mux hands out the private key base64-encoded; accept raw PEM too. */
export function decodePrivateKey(value: string): string {
  const v = value.trim()
  return v.startsWith('-----BEGIN') ? v : Buffer.from(v, 'base64').toString('utf8')
}

export function signPlaybackToken(
  playbackId: string,
  audience: TokenAudience,
  ttlSeconds: number,
  opts: { keyId?: string; privateKey?: string; now?: number } = {},
): string {
  const keyId = opts.keyId ?? process.env.MUX_SIGNING_KEY_ID?.trim()
  const privateKey = opts.privateKey ?? process.env.MUX_SIGNING_KEY_PRIVATE
  if (!keyId || !privateKey) throw new Error('Mux signing key is not configured (MUX_SIGNING_KEY_ID / MUX_SIGNING_KEY_PRIVATE).')
  const header = { alg: 'RS256', typ: 'JWT', kid: keyId }
  const payload = {
    sub: playbackId,
    aud: audience,
    exp: Math.floor((opts.now ?? Date.now()) / 1000) + ttlSeconds,
    kid: keyId,
  }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const signature = createSign('RSA-SHA256').update(signingInput).sign(decodePrivateKey(privateKey))
  return `${signingInput}.${b64url(signature)}`
}

/* ------------------------------------------------------------------ */
/* Webhook signature verification                                       */
/* ------------------------------------------------------------------ */

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

export type SignatureResult = { ok: true } | { ok: false; reason: 'missing' | 'malformed' | 'mismatch' | 'expired' }

/**
 * Mux-Signature header: `t=<unix seconds>,v1=<hex hmac-sha256>` where the HMAC (keyed with the webhook
 * signing secret) covers `<t>.<raw request body>`.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now: number = Date.now(),
): SignatureResult {
  if (!header) return { ok: false, reason: 'missing' }
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=')
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    }),
  ) as Record<string, string>
  const timestamp = Number(parts.t)
  if (!Number.isFinite(timestamp) || !parts.v1) return { ok: false, reason: 'malformed' }

  const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest()
  let given: Buffer
  try {
    given = Buffer.from(parts.v1, 'hex')
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'mismatch' }
  if (Math.abs(Math.floor(now / 1000) - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: 'expired' }
  return { ok: true }
}
