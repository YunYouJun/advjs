import { describe, expect, it } from 'vitest'
import {
  ADV_COS_IMMUTABLE_CACHE_CONTROL,
  ADV_COS_MANIFEST_CACHE_CONTROL,
  contentTypeForObjectKey,
  defaultUploadOptions,
  isContentHashedObjectKey,
  normalizeCosObjectKey,
  normalizeCosPrefix,
} from '../src'

describe('cos asset standard', () => {
  it('recognizes ADV.JS immutable object names and MIME types', () => {
    const image = 'games/hamster/v1/cg/star-in-hand.0123456789ab.webp'
    expect(isContentHashedObjectKey(image)).toBe(true)
    expect(defaultUploadOptions(image)).toEqual({
      cacheControl: ADV_COS_IMMUTABLE_CACHE_CONTROL,
      contentType: 'image/webp',
    })
    expect(contentTypeForObjectKey('games/hamster/v1/audio/bgm/theme.01234567.ogg')).toBe('audio/ogg')
  })

  it('keeps stable manifests revalidated instead of immutable', () => {
    expect(isContentHashedObjectKey('games/hamster/v1/manifests/assets.json')).toBe(false)
    expect(defaultUploadOptions('games/hamster/v1/manifests/assets.json')).toEqual({
      cacheControl: ADV_COS_MANIFEST_CACHE_CONTROL,
      contentType: 'application/json; charset=utf-8',
    })
  })

  it('rejects absolute and traversing COS keys', () => {
    expect(normalizeCosObjectKey('games/example/v1/cg/shot.webp')).toBe('games/example/v1/cg/shot.webp')
    expect(normalizeCosPrefix('games/example/v1')).toBe('games/example/v1/')
    expect(normalizeCosPrefix('')).toBe('')
    expect(() => normalizeCosObjectKey('/games/example')).toThrow(/relative path/u)
    expect(() => normalizeCosObjectKey('games/../secret')).toThrow(/invalid path segment/u)
  })
})
