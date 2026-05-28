/**
 * Phase 16 — 剧情提议器。
 *
 * 给定当前章节 + 角色 + 最近世界事件，AI 提议 3 条后续走向。
 * 走 JSON 提取通道（非流式），输出结构化分支候选供作者选择。
 */

import type { AdvCharacter } from '@advjs/types'
import type { ChapterFormData } from '../chapterMd'
import type { AiAuthoringResult } from './result'
import { runAiJsonExtractionResult } from '../aiExtraction'

export interface PlotSuggestion {
  label: string
  synopsis: string
  hook: string
}

export interface SuggestPlotOptions {
  chapter: ChapterFormData
  characters: AdvCharacter[]
  worldMd?: string
  recentEvents?: string[]
  hint?: string
}

function buildPrompt(opts: SuggestPlotOptions): string {
  const charList = opts.characters.length > 0
    ? opts.characters.map(c => `  - @${c.id}（${c.name}）`).join('\n')
    : '  （未指定角色）'
  const eventList = opts.recentEvents && opts.recentEvents.length > 0
    ? opts.recentEvents.map(e => `  - ${e}`).join('\n')
    : '  （暂无最近事件）'

  return [
    `你是 ADV.JS 互动小说编剧。请基于当前章节状态，提议 3 条后续剧情走向。`,
    ``,
    `# 世界设定`,
    opts.worldMd?.trim() || '（未提供）',
    ``,
    `# 当前章节`,
    `- 标题：${opts.chapter.title || opts.chapter.filename}`,
    opts.chapter.plotSummary?.trim() ? `- 梗概：${opts.chapter.plotSummary.trim()}` : '',
    ``,
    `## 章节正文片段（仅供上下文）`,
    opts.chapter.content?.trim().slice(0, 1500) || '（章节正文为空）',
    ``,
    `# 出场角色`,
    charList,
    ``,
    `# 最近世界事件`,
    eventList,
    ``,
    opts.hint?.trim() ? `# 作者引导\n${opts.hint.trim()}\n` : '',
    `# 输出 JSON Schema`,
    `{`,
    `  "suggestions": [`,
    `    {`,
    `      "label": "简短走向标签（≤ 14 字）",`,
    `      "synopsis": "走向梗概（1-3 句）",`,
    `      "hook": "可作为伏笔或转折的关键事件（1 句）"`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `要求：`,
    `- 必须给出 3 条提议；`,
    `- 三条走向之间应有明显差异（情感弧 / 冲突类型 / 角色立场）；`,
    `- 全程中文；除 JSON 外不得有任何其他内容。`,
  ].filter(Boolean).join('\n')
}

interface RawSuggestion {
  label?: unknown
  synopsis?: unknown
  hook?: unknown
}

interface RawResponse {
  suggestions?: unknown
}

function validate(raw: unknown): PlotSuggestion[] {
  const root = raw as RawResponse
  const list = Array.isArray(root?.suggestions) ? root.suggestions : []
  const out: PlotSuggestion[] = []
  for (const item of list as RawSuggestion[]) {
    if (typeof item?.label !== 'string' || typeof item?.synopsis !== 'string')
      continue
    out.push({
      label: item.label.trim(),
      synopsis: item.synopsis.trim(),
      hook: typeof item.hook === 'string' ? item.hook.trim() : '',
    })
  }
  if (out.length === 0)
    throw new Error('No valid plot suggestions')
  return out
}

/**
 * Returns 3 plot suggestions or a structured error.
 */
export async function suggestPlot(
  opts: SuggestPlotOptions,
): Promise<AiAuthoringResult<PlotSuggestion[]>> {
  const prompt = buildPrompt(opts)
  return runAiJsonExtractionResult<PlotSuggestion[]>(
    { prompt, maxTokens: 1200, temperature: 0.85 },
    validate,
    1,
  )
}

// Exposed for unit tests.
export const __internal = { buildPrompt, validate }
