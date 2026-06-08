/**
 * Phase 18 — Marketplace AI 自动打标。
 *
 * 给定项目的名称 / 简介 / 世界设定 / 角色卡，AI 输出建议的题材（genre）、
 * 风格（style）与若干自由标签（tags），约束在 {@link marketTaxonomy} 定义的
 * 枚举内。结果供发布表单一键填充，作者可再手动调整。
 */

import type { AdvCharacter } from '@advjs/types'
import type { MarketGenre, MarketStyle } from '../marketTaxonomy'
import type { AiAuthoringResult } from './result'
import { runAiJsonExtractionResult } from '../aiExtraction'
import {
  MARKET_GENRES,
  MARKET_STYLES,
  normalizeGenre,
  normalizeStyle,
} from '../marketTaxonomy'

export interface SuggestMarketTagsOptions {
  name: string
  description?: string
  worldMd?: string
  characters?: AdvCharacter[]
}

export interface MarketTagSuggestion {
  genre?: MarketGenre
  style?: MarketStyle
  tags: string[]
}

/** Max free-form tags we keep from the model (avoid noise). */
const MAX_TAGS = 6
/** Cap each tag length so a runaway model can't write an essay into a chip. */
const MAX_TAG_LEN = 16

function buildPrompt(opts: SuggestMarketTagsOptions): string {
  const genreList = MARKET_GENRES.map(g => g.id).join(' | ')
  const styleList = MARKET_STYLES.map(s => s.id).join(' | ')
  const charList = opts.characters && opts.characters.length > 0
    ? opts.characters.slice(0, 12).map((c) => {
        const traits = [c.personality, c.background].filter(Boolean).join('；')
        return `  - ${c.name}${traits ? ` — ${traits}` : ''}`
      }).join('\n')
    : '  （未提供）'

  return [
    `你是互动小说市场的内容策展编辑。根据下列作品信息，给出最贴切的题材、风格与标签，用于市场分类。`,
    ``,
    `# 作品名称`,
    opts.name || '（未命名）',
    ``,
    `# 简介`,
    opts.description?.trim() || '（无）',
    ``,
    `# 世界设定`,
    opts.worldMd?.trim()?.slice(0, 2000) || '（未提供）',
    ``,
    `# 主要角色`,
    charList,
    ``,
    `# 输出 JSON Schema`,
    `{`,
    `  "genre": "从这些值中选最贴切的一个：${genreList}",`,
    `  "style": "从这些值中选最贴切的一个：${styleList}",`,
    `  "tags": ["3-6 个自由中文短标签，每个 ≤ 6 字，如 校园、治愈、反转"]`,
    `}`,
    ``,
    `要求：`,
    `- genre / style 必须严格使用上面给定的英文枚举值，不得自创；若实在无法判断可省略该字段；`,
    `- tags 用简短中文词，不要带井号或标点；`,
    `- 除 JSON 外不得输出任何其他内容。`,
  ].filter(Boolean).join('\n')
}

interface RawResponse {
  genre?: unknown
  style?: unknown
  tags?: unknown
}

function validate(raw: unknown): MarketTagSuggestion {
  const root = raw as RawResponse
  const tags: string[] = []
  const seen = new Set<string>()
  if (Array.isArray(root?.tags)) {
    for (const item of root.tags) {
      if (typeof item !== 'string')
        continue
      const tag = item.trim().replace(/^#+/, '').slice(0, MAX_TAG_LEN).trim()
      const key = tag.toLowerCase()
      if (tag && !seen.has(key)) {
        seen.add(key)
        tags.push(tag)
      }
      if (tags.length >= MAX_TAGS)
        break
    }
  }
  return {
    genre: normalizeGenre(root?.genre),
    style: normalizeStyle(root?.style),
    tags,
  }
}

/**
 * Returns AI-suggested marketplace taxonomy or a structured error.
 */
export async function suggestMarketTags(
  opts: SuggestMarketTagsOptions,
): Promise<AiAuthoringResult<MarketTagSuggestion>> {
  const prompt = buildPrompt(opts)
  return runAiJsonExtractionResult<MarketTagSuggestion>(
    { prompt, maxTokens: 400, temperature: 0.4 },
    validate,
    1,
  )
}

export const __internal = { buildPrompt, validate }
