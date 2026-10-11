import { describe, expect, it } from 'vitest'
import { formatBytes, mediaSource, sniffVideoType } from './media'

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)))

describe('sniffVideoType', () => {
  it('recognises MP4, MOV, 3GP and WebM by their bytes', () => {
    expect(sniffVideoType(bytes([0, 0, 0, 0x18], 'ftyp', 'isom', [0, 0]))).toBe('video/mp4')
    expect(sniffVideoType(bytes([0, 0, 0, 0x14], 'ftyp', 'qt  ', [0, 0]))).toBe('video/quicktime')
    expect(sniffVideoType(bytes([0, 0, 0, 0x14], 'ftyp', '3gp4', [0, 0]))).toBe('video/3gpp')
    expect(sniffVideoType(bytes([0x1a, 0x45, 0xdf, 0xa3], 'webmwebmwebm'))).toBe('video/webm')
  })
  it('rejects anything else, whatever its name claims', () => {
    expect(sniffVideoType(bytes('<html><script>x'))).toBeNull()
    expect(sniffVideoType(bytes([0x89], 'PNG', [0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
    expect(sniffVideoType(bytes('MZ', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
    expect(sniffVideoType(bytes([0, 0]))).toBeNull()
  })
})

describe('mediaSource', () => {
  it('routes uploads and YouTube ids to the right player', () => {
    expect(mediaSource('upload', '3c0a9a8e-0000-4000-8000-000000000000')).toEqual({ youtubeId: null, uploadId: '3c0a9a8e-0000-4000-8000-000000000000' })
    expect(mediaSource('youtube', 'SlbyzVMQ44w')).toEqual({ youtubeId: 'SlbyzVMQ44w', uploadId: null })
    expect(mediaSource('youtube', 'not-a-valid-id')).toEqual({ youtubeId: null, uploadId: null })
    expect(mediaSource('youtube', null)).toEqual({ youtubeId: null, uploadId: null })
  })
})

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(300 * 1024 * 1024)).toBe('300 MB')
  })
})
