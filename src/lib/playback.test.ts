import { generateKeyPairSync } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { muxThumbnailUrl } = await import('./playback')
const { playbackForVideo, playbackForEvent, staffThumbnail } = await import('./playback-server')

beforeAll(() => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  vi.stubEnv('MUX_SIGNING_KEY_ID', 'KID')
  vi.stubEnv('MUX_SIGNING_KEY_PRIVATE', Buffer.from(privateKey).toString('base64'))
})

const PUB = 'PUBLICplaybackId1234567890'
const PRIV = 'PRIVATEplaybackId1234567890'

describe('playbackForVideo', () => {
  const base = { provider: 'mux', providerRef: null, muxPublicPlaybackId: null, muxPrivatePlaybackId: PRIV, mediaStatus: 'ready' as const }
  it('plays the public id without a token once published', () => {
    const s = playbackForVideo({ ...base, muxPublicPlaybackId: PUB }, { preview: false })
    expect(s).toMatchObject({ kind: 'mux', playbackId: PUB, token: null })
  })
  it('never exposes the private id to the public', () => {
    expect(playbackForVideo(base, { preview: false })).toEqual({ kind: 'none', reason: 'missing' })
  })
  it('lets staff preview an unpublished video with a signed token', () => {
    const s = playbackForVideo(base, { preview: true })
    expect(s.kind).toBe('mux')
    if (s.kind === 'mux') {
      expect(s.playbackId).toBe(PRIV)
      expect(s.token?.split('.')).toHaveLength(3)
      expect(s.thumbnailToken?.split('.')).toHaveLength(3)
    }
  })
  it('reports processing and failed media', () => {
    expect(playbackForVideo({ ...base, mediaStatus: 'processing' }, { preview: true })).toEqual({ kind: 'none', reason: 'processing' })
    expect(playbackForVideo({ ...base, mediaStatus: 'errored' }, { preview: true })).toEqual({ kind: 'none', reason: 'errored' })
  })
  it('keeps legacy YouTube and upload rows playing', () => {
    expect(playbackForVideo({ provider: 'youtube', providerRef: 'SlbyzVMQ44w' }, { preview: false })).toEqual({ kind: 'youtube', id: 'SlbyzVMQ44w' })
    expect(playbackForVideo({ provider: 'upload', providerRef: 'abc' }, { preview: false })).toEqual({ kind: 'upload', id: 'abc' })
    expect(playbackForVideo({ provider: 'youtube', providerRef: 'not-an-id' }, { preview: false }).kind).toBe('none')
  })
  it('rejects malformed Mux ids instead of putting them in URLs', () => {
    expect(playbackForVideo({ ...base, muxPublicPlaybackId: 'a/../b' }, { preview: false }).kind).toBe('none')
  })
})

describe('playbackForEvent', () => {
  it('only exposes the public id while one exists; staff can preview privately', () => {
    const e = { provider: 'mux', providerRef: null, muxPublicPlaybackId: null, muxPrivatePlaybackId: PRIV, status: 'scheduled' }
    expect(playbackForEvent(e, { preview: false }).kind).toBe('none')
    expect(playbackForEvent(e, { preview: true })).toMatchObject({ kind: 'mux', playbackId: PRIV, live: true })
    expect(playbackForEvent({ ...e, status: 'live', muxPublicPlaybackId: PUB }, { preview: false })).toMatchObject({ playbackId: PUB, token: null })
    // A stale public id on an ended event must not play.
    expect(playbackForEvent({ ...e, status: 'ended', muxPublicPlaybackId: PUB }, { preview: false }).kind).toBe('none')
  })
})

describe('thumbnails', () => {
  it('sizes public thumbnails and tokenises private ones without size params', () => {
    expect(muxThumbnailUrl(PUB, { width: 640 })).toBe(`https://image.mux.com/${PUB}/thumbnail.webp?width=640`)
    expect(muxThumbnailUrl(PRIV, { token: 'T' })).toBe(`https://image.mux.com/${PRIV}/thumbnail.webp?token=T`)
  })
  it('staff lists get signed thumbnails for private media', () => {
    expect(staffThumbnail({ provider: 'mux', providerRef: null, muxPrivatePlaybackId: PRIV })).toMatch(/^https:\/\/image\.mux\.com\/PRIVATE.*\?token=/)
    expect(staffThumbnail({ provider: 'youtube', providerRef: 'x' })).toBeNull()
  })
})
