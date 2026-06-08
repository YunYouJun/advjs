import { describe, expect, it } from 'vitest'
import { __internal as taggerInternal } from '../utils/aiAuthoring/marketTagger'
import {
  deriveDuration,
  DURATION_THRESHOLDS,
  durationLabelKey,
  genreLabelKey,
  MARKET_DURATIONS,
  MARKET_GENRES,
  MARKET_STYLES,
  normalizeDuration,
  normalizeGenre,
  normalizeStyle,
  styleLabelKey,
} from '../utils/marketTaxonomy'

describe('marketTaxonomy', () => {
  describe('deriveDuration', () => {
    it('buckets by chapter count thresholds', () => {
      expect(deriveDuration(0)).toBe('short')
      expect(deriveDuration(DURATION_THRESHOLDS.short)).toBe('short')
      expect(deriveDuration(DURATION_THRESHOLDS.short + 1)).toBe('medium')
      expect(deriveDuration(DURATION_THRESHOLDS.medium)).toBe('medium')
      expect(deriveDuration(DURATION_THRESHOLDS.medium + 1)).toBe('long')
      expect(deriveDuration(100)).toBe('long')
    })
  })

  describe('normalizers', () => {
    it('accepts known ids and rejects everything else', () => {
      expect(normalizeGenre('romance')).toBe('romance')
      expect(normalizeGenre('nonsense')).toBeUndefined()
      expect(normalizeGenre(42)).toBeUndefined()
      expect(normalizeGenre(undefined)).toBeUndefined()

      expect(normalizeStyle('galgame')).toBe('galgame')
      expect(normalizeStyle('')).toBeUndefined()

      expect(normalizeDuration('long')).toBe('long')
      expect(normalizeDuration('forever')).toBeUndefined()
    })
  })

  describe('labelKey lookups', () => {
    it('returns the i18n key for known ids', () => {
      expect(genreLabelKey('mystery')).toBe('marketplace.genre.mystery')
      expect(styleLabelKey('rpg')).toBe('marketplace.style.rpg')
      expect(durationLabelKey('short')).toBe('marketplace.duration.short')
    })

    it('falls back to the raw id (or empty) for unknown values', () => {
      expect(genreLabelKey('custom')).toBe('custom')
      expect(styleLabelKey(undefined)).toBe('')
    })
  })

  it('keeps option ids unique within each dimension', () => {
    const allDims = [MARKET_GENRES, MARKET_STYLES, MARKET_DURATIONS]
    for (const dim of allDims) {
      const ids = dim.map(o => o.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('marketTagger.validate', () => {
  const { validate } = taggerInternal

  it('normalizes genre/style and dedups/caps tags', () => {
    const out = validate({
      genre: 'mystery',
      style: 'rpg',
      tags: ['#校园', '校园', '  治愈  ', '反转', '热血', '悬疑', '推理', '冒险'],
    })
    expect(out.genre).toBe('mystery')
    expect(out.style).toBe('rpg')
    // '#校园' strips to '校园', the literal '校园' is a dup → dropped; capped at 6
    expect(out.tags).toEqual(['校园', '治愈', '反转', '热血', '悬疑', '推理'])
  })

  it('drops invalid taxonomy values and non-string tags', () => {
    const out = validate({
      genre: 'invalid-genre',
      style: 123,
      tags: ['ok', 42, null, ''],
    })
    expect(out.genre).toBeUndefined()
    expect(out.style).toBeUndefined()
    expect(out.tags).toEqual(['ok'])
  })

  it('tolerates a malformed root', () => {
    expect(validate(null)).toEqual({ genre: undefined, style: undefined, tags: [] })
    expect(validate({})).toEqual({ genre: undefined, style: undefined, tags: [] })
  })
})
