import { describe, expect, it } from 'vitest'
import { parseYouTubeId, youTubeEmbedUrl } from './youtube'

describe('parseYouTubeId', () => {
  it.each([
    ['SlbyzVMQ44w', 'SlbyzVMQ44w'],
    ['https://www.youtube.com/watch?v=SlbyzVMQ44w', 'SlbyzVMQ44w'],
    ['https://youtube.com/watch?v=SlbyzVMQ44w&t=30s', 'SlbyzVMQ44w'],
    ['https://m.youtube.com/watch?v=SlbyzVMQ44w', 'SlbyzVMQ44w'],
    ['https://youtu.be/SlbyzVMQ44w?si=abc', 'SlbyzVMQ44w'],
    ['https://www.youtube.com/live/SlbyzVMQ44w?feature=share', 'SlbyzVMQ44w'],
    ['https://www.youtube.com/shorts/SlbyzVMQ44w', 'SlbyzVMQ44w'],
    ['https://www.youtube-nocookie.com/embed/SlbyzVMQ44w', 'SlbyzVMQ44w'],
  ])('extracts the id from %s', (input, expected) => {
    expect(parseYouTubeId(input)).toBe(expected)
  })

  it.each([
    '',
    'not a url',
    'SlbyzVMQ44',
    'SlbyzVMQ44w"><script>',
    'https://evil.example.com/watch?v=SlbyzVMQ44w',
    'https://youtube.com.evil.com/watch?v=SlbyzVMQ44w',
    'javascript:alert(1)',
    'https://www.youtube.com/watch?v=SlbyzVMQ44w/../x',
  ])('rejects %s', (input) => {
    expect(parseYouTubeId(input)).toBeNull()
  })
})

describe('youTubeEmbedUrl', () => {
  it('uses privacy-enhanced mode', () => {
    expect(youTubeEmbedUrl('SlbyzVMQ44w')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/SlbyzVMQ44w\?/)
  })
  it('refuses anything that is not a strict id', () => {
    expect(() => youTubeEmbedUrl('abc?autoplay=1&x')).toThrow()
  })
})
