import { describe, expect, it } from 'vitest'
import { getBgmSrcUrl } from '../../packages/core/src/utils/bgm'

describe('getBgmSrcUrl', () => {
  it('resolves a library track name through the configured CDN', () => {
    expect(getBgmSrcUrl({
      cdnUrl: 'https://cos.advjs.yunle.fun/',
      bgmName: 'quiet-observatory',
    })).toBe('https://cos.advjs.yunle.fun/bgms/library/quiet-observatory.mp3')
  })

  it.each([
    '/audio/observatory.wav',
    './audio/observatory.ogg',
    'https://assets.example.com/observatory.flac',
    'data:audio/wav;base64,UklGRg==',
  ])('preserves a direct audio source: %s', (bgmName) => {
    expect(getBgmSrcUrl({
      cdnUrl: 'https://cos.advjs.yunle.fun',
      bgmName,
    })).toBe(bgmName)
  })
})
