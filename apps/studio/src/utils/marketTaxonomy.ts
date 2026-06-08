/**
 * Phase 18 — Marketplace 分类与标签体系。
 *
 * 题材（genre）/ 风格（style）/ 时长（duration）三个结构化维度的单一事实源，
 * 由发布表单、市场筛选器、AI 自动打标共享，保证三处用同一套 id / 文案。
 *
 * 设计原则：
 * - id 是稳定的英文 slug，写入 CloudBase；展示走 i18n labelKey。
 * - 自由 tag 仍保留（`MarketplaceRecord.tags`），结构化维度是其上的策展层。
 */

export type MarketGenre
  = | 'romance'
    | 'mystery'
    | 'fantasy'
    | 'scifi'
    | 'slice-of-life'
    | 'horror'
    | 'history'
    | 'adventure'
    | 'comedy'
    | 'drama'

export type MarketStyle
  = | 'galgame'
    | 'rpg'
    | 'kinetic'
    | 'branching'
    | 'simulation'

export type MarketDuration = 'short' | 'medium' | 'long'

export interface TaxonomyOption<T extends string> {
  id: T
  /** i18n key under `marketplace.*` */
  labelKey: string
  icon: string
}

export const MARKET_GENRES: readonly TaxonomyOption<MarketGenre>[] = [
  { id: 'romance', labelKey: 'marketplace.genre.romance', icon: '💕' },
  { id: 'mystery', labelKey: 'marketplace.genre.mystery', icon: '🔍' },
  { id: 'fantasy', labelKey: 'marketplace.genre.fantasy', icon: '🧙' },
  { id: 'scifi', labelKey: 'marketplace.genre.scifi', icon: '🚀' },
  { id: 'slice-of-life', labelKey: 'marketplace.genre.slice-of-life', icon: '☕' },
  { id: 'horror', labelKey: 'marketplace.genre.horror', icon: '👻' },
  { id: 'history', labelKey: 'marketplace.genre.history', icon: '📜' },
  { id: 'adventure', labelKey: 'marketplace.genre.adventure', icon: '🗺' },
  { id: 'comedy', labelKey: 'marketplace.genre.comedy', icon: '😄' },
  { id: 'drama', labelKey: 'marketplace.genre.drama', icon: '🎭' },
] as const

export const MARKET_STYLES: readonly TaxonomyOption<MarketStyle>[] = [
  { id: 'galgame', labelKey: 'marketplace.style.galgame', icon: '🌸' },
  { id: 'rpg', labelKey: 'marketplace.style.rpg', icon: '⚔️' },
  { id: 'kinetic', labelKey: 'marketplace.style.kinetic', icon: '📖' },
  { id: 'branching', labelKey: 'marketplace.style.branching', icon: '🌿' },
  { id: 'simulation', labelKey: 'marketplace.style.simulation', icon: '🎮' },
] as const

export const MARKET_DURATIONS: readonly TaxonomyOption<MarketDuration>[] = [
  { id: 'short', labelKey: 'marketplace.duration.short', icon: '⚡' },
  { id: 'medium', labelKey: 'marketplace.duration.medium', icon: '⏳' },
  { id: 'long', labelKey: 'marketplace.duration.long', icon: '📚' },
] as const

const GENRE_IDS = new Set<string>(MARKET_GENRES.map(g => g.id))
const STYLE_IDS = new Set<string>(MARKET_STYLES.map(s => s.id))
const DURATION_IDS = new Set<string>(MARKET_DURATIONS.map(d => d.id))

/** Duration bucket thresholds (by chapter count). short ≤ 3, medium ≤ 8, else long. */
export const DURATION_THRESHOLDS = { short: 3, medium: 8 } as const

/**
 * Derive a duration bucket from chapter count. Pure + deterministic so the
 * publish form can show a default the author may override.
 */
export function deriveDuration(chapters: number): MarketDuration {
  if (chapters <= DURATION_THRESHOLDS.short)
    return 'short'
  if (chapters <= DURATION_THRESHOLDS.medium)
    return 'medium'
  return 'long'
}

/** Narrow an arbitrary string to a valid genre id, or `undefined`. */
export function normalizeGenre(value: unknown): MarketGenre | undefined {
  return typeof value === 'string' && GENRE_IDS.has(value) ? value as MarketGenre : undefined
}

/** Narrow an arbitrary string to a valid style id, or `undefined`. */
export function normalizeStyle(value: unknown): MarketStyle | undefined {
  return typeof value === 'string' && STYLE_IDS.has(value) ? value as MarketStyle : undefined
}

/** Narrow an arbitrary string to a valid duration id, or `undefined`. */
export function normalizeDuration(value: unknown): MarketDuration | undefined {
  return typeof value === 'string' && DURATION_IDS.has(value) ? value as MarketDuration : undefined
}

/** Look up the i18n labelKey for a genre id (falls back to the raw id). */
export function genreLabelKey(id: string | undefined): string {
  return MARKET_GENRES.find(g => g.id === id)?.labelKey ?? id ?? ''
}

/** Look up the i18n labelKey for a style id (falls back to the raw id). */
export function styleLabelKey(id: string | undefined): string {
  return MARKET_STYLES.find(s => s.id === id)?.labelKey ?? id ?? ''
}

/** Look up the i18n labelKey for a duration id (falls back to the raw id). */
export function durationLabelKey(id: string | undefined): string {
  return MARKET_DURATIONS.find(d => d.id === id)?.labelKey ?? id ?? ''
}
