import { parsePublicHttpsUrl } from '@advjs/assets'
import { describe, expect, it } from 'vitest'

const accepted = [
  'https://suno.com/song/author-owned-example',
  'https://suno.com/create',
  'HTTPS://Suno.COM/Song/ID',
  'https://suno.com',
  'https://suno.com:443/x',
  'https://suno.com:8443/x',
  'https://a-b.example.co.uk/a/b/c/',
  'https://example.com/%E9%9F%B3%E4%B9%90',
  'https://example.com/a;b=c/d:e@f/~g!$&\'()*+,',
  '  https://example.com/padded  ',
]

const rejected = [
  'https://user:password@suno.com/song/id',
  'https://suno.com/song/id?token=private',
  'https://suno.com/song/id?',
  'https://suno.com/song/id#private',
  'javascript:alert(1)',
  'file:///private/song.wav',
  'http://suno.com/song',
  'https:suno.com/song',
  'https://127.0.0.1/song',
  'https://0x7f.1/song',
  'https://localhost/song',
  'https://xn--fiq228c.com/song',
  'https://例子.com/song',
  'https://suno..com/song',
  'https://suno.com./song',
  'https://-suno.com/song',
  'https://suno.com:0443/song',
  'https://suno.com:99999/song',
  'https://suno.com/a/../b',
  'https://suno.com/a/%2e%2e/b',
  'https://suno.com/a b',
  'https://suno.com/a\\b',
  'https://suno.com/a|b',
  'https://suno.com/%zz',
]

describe('parsePublicHttpsUrl', () => {
  it.each(accepted)('matches WHATWG URL for %s', (input) => {
    const result = parsePublicHttpsUrl(input)
    const reference = new URL(input)
    expect(result).toEqual({ ok: true, href: reference.href })
    expect(reference.protocol).toBe('https:')
    expect(reference.username + reference.password + reference.search + reference.hash).toBe('')
  })

  it.each(rejected)('rejects %s', (input) => {
    expect(parsePublicHttpsUrl(input).ok).toBe(false)
  })

  it('separates non-URLs from unsafe URLs', () => {
    expect(parsePublicHttpsUrl('not a url')).toEqual({ ok: false, reason: 'not-absolute' })
    expect(parsePublicHttpsUrl('ftp://example.com/song')).toEqual({ ok: false, reason: 'not-public-https' })
  })
})
