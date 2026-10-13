import { createHmac, createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { decodePrivateKey, signPlaybackToken, verifyWebhookSignature } = await import('./mux-security')

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const b64Key = Buffer.from(privateKey).toString('base64')

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))

describe('signPlaybackToken', () => {
  const now = Date.UTC(2026, 9, 12, 12, 0, 0)
  it('produces an RS256 JWT with the claims Mux expects', () => {
    const token = signPlaybackToken('PB123', 'v', 3600, { keyId: 'KID1', privateKey: b64Key, now })
    const [h, p, s] = token.split('.') as [string, string, string]
    expect(decode(h)).toEqual({ alg: 'RS256', typ: 'JWT', kid: 'KID1' })
    expect(decode(p)).toEqual({ sub: 'PB123', aud: 'v', exp: Math.floor(now / 1000) + 3600, kid: 'KID1' })
    const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(createPublicKey(publicKey), Buffer.from(s, 'base64url'))
    expect(ok).toBe(true)
  })
  it('accepts a raw PEM as well as the base64 form Mux provides', () => {
    expect(decodePrivateKey(privateKey)).toBe(privateKey.trim())
    expect(decodePrivateKey(b64Key)).toBe(privateKey)
    expect(() => signPlaybackToken('PB123', 't', 60, { keyId: 'K', privateKey, now })).not.toThrow()
  })
  it('uses the audience for thumbnails and storyboards', () => {
    const t = signPlaybackToken('PB', 't', 60, { keyId: 'K', privateKey: b64Key, now }).split('.')[1]!
    expect(decode(t).aud).toBe('t')
  })
  it('fails clearly when the key is missing', () => {
    vi.stubEnv('MUX_SIGNING_KEY_ID', '')
    vi.stubEnv('MUX_SIGNING_KEY_PRIVATE', '')
    expect(() => signPlaybackToken('PB', 'v', 60)).toThrow(/not configured/)
    vi.unstubAllEnvs()
  })
})

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test'
  const body = JSON.stringify({ type: 'video.asset.ready', id: 'evt_1', data: { id: 'a1' } })
  const now = 1_790_000_000_000
  const t = Math.floor(now / 1000)
  const sign = (b: string, ts = t, s = secret) => `t=${ts},v1=${createHmac('sha256', s).update(`${ts}.${b}`).digest('hex')}`

  it('accepts a correctly signed, fresh request', () => {
    expect(verifyWebhookSignature(body, sign(body), secret, now)).toEqual({ ok: true })
  })
  it('rejects a changed body, a wrong secret and a missing header', () => {
    expect(verifyWebhookSignature(body + ' ', sign(body), secret, now)).toEqual({ ok: false, reason: 'mismatch' })
    expect(verifyWebhookSignature(body, sign(body, t, 'other'), secret, now)).toEqual({ ok: false, reason: 'mismatch' })
    expect(verifyWebhookSignature(body, null, secret, now)).toEqual({ ok: false, reason: 'missing' })
  })
  it('rejects malformed headers', () => {
    expect(verifyWebhookSignature(body, 'garbage', secret, now).ok).toBe(false)
    expect(verifyWebhookSignature(body, `t=${t}`, secret, now)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyWebhookSignature(body, `t=abc,v1=00`, secret, now)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyWebhookSignature(body, `t=${t},v1=zz`, secret, now)).toEqual({ ok: false, reason: 'mismatch' })
  })
  it('rejects replays older than five minutes', () => {
    const old = t - 6 * 60
    expect(verifyWebhookSignature(body, sign(body, old), secret, now)).toEqual({ ok: false, reason: 'expired' })
    expect(verifyWebhookSignature(body, sign(body, t - 4 * 60), secret, now)).toEqual({ ok: true })
  })
})
