import { afterEach, describe, expect, it } from 'vitest'
import { isHttps, siteUrl } from './site'

const original = process.env.SITE_URL
afterEach(() => {
  process.env.SITE_URL = original
})

describe('siteUrl', () => {
  it('strips trailing slashes and whitespace', () => {
    process.env.SITE_URL = ' https://eyetv.paxofi.com/ '
    expect(siteUrl()).toBe('https://eyetv.paxofi.com')
    expect(isHttps()).toBe(true)
  })
  it('falls back to localhost', () => {
    delete process.env.SITE_URL
    expect(siteUrl()).toBe('http://localhost:3000')
    expect(isHttps()).toBe(false)
  })
})
