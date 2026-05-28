/**
 * Phase 16 — 一致性守门。
 *
 * 给定一个章节的 AdvScript 正文 + 角色卡 + 世界设定，
 * AI 输出一致性 issues 列表（人设漂移 / 时间线矛盾 / 伏笔未回收 等）。
 */

import type { AdvCharacter } from '@advjs/types'
import type { ChapterFormData } from '../chapterMd'
import type { AiAuthoringResult } from './result'
import { runAiJsonExtractionResult } from '../aiExtraction'

export type ConsistencyIssueKind
  = | 'character-drift'
    | 'timeline'
    | 'world-conflict'
    | 'unresolved-foreshadow'
    | 'continuity'
    | 'other'

export type ConsistencyIssueSeverity = 'info' | 'warn' | 'error'

export interface ConsistencyIssue {
  kind: ConsistencyIssueKind
  severity: ConsistencyIssueSeverity
  title: string
  detail: string
  suggestion?: string
  characterId?: string
}

export interface CheckConsistencyOptions {
  chapter: ChapterFormData
  characters: AdvCharacter[]
  worldMd?: string
  outlineMd?: string
}

const VALID_KINDS: ConsistencyIssueKind[] = [
  'character-drift',
  'timeline',
  'world-conflict',
  'unresolved-foreshadow',
  'continuity',
  'other',
]

const VALID_SEVERITIES: ConsistencyIssueSeverity[] = ['info', 'warn', 'error']

function buildPrompt(opts: CheckConsistencyOptions): string {
  const charList = opts.characters.length > 0
    ? opts.characters.map((c) => {
        const traits = [c.personality, c.background].filter(Boolean).join('；')
        return `  - @${c.id}（${c.name}）${traits ? ` — ${traits}` : ''}`
      }).join('\n')
    : '  （未提供）'

  return [
    `你是 ADV.JS 互动小说审稿编辑。请审查下列章节正文，找出可能影响一致性的问题。`,
    ``,
    `# 世界设定`,
    opts.worldMd?.trim() || '（未提供）',
    ``,
    `# 故事大纲（供上下文）`,
    opts.outlineMd?.trim() || '（未提供）',
    ``,
    `# 角色卡`,
    charList,
    ``,
    `# 章节信息`,
    `- 标题：${opts.chapter.title || opts.chapter.filename}`,
    opts.chapter.plotSummary?.trim() ? `- 梗概：${opts.chapter.plotSummary.trim()}` : '',
    ``,
    `## 章节正文（AdvScript）`,
    opts.chapter.content?.trim() || '（章节正文为空）',
    ``,
    `# 输出 JSON Schema`,
    `{`,
    `  "issues": [`,
    `    {`,
    `      "kind": "character-drift | timeline | world-conflict | unresolved-foreshadow | continuity | other",`,
    `      "severity": "info | warn | error",`,
    `      "title": "问题概括（≤ 20 字）",`,
    `      "detail": "问题详情（含具体台词或片段引用）",`,
    `      "suggestion": "改进建议（可选）",`,
    `      "characterId": "若与角色相关，写其 id（可选）"`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `要求：`,
    `- 仅列出真正值得作者注意的问题，最多 8 条；若章节没问题，返回 { "issues": [] }；`,
    `- 不要捏造问题；如不确定，标 severity=info；`,
    `- 全程中文；除 JSON 外不得有任何其他内容。`,
  ].filter(Boolean).join('\n')
}

interface RawIssue {
  kind?: unknown
  severity?: unknown
  title?: unknown
  detail?: unknown
  suggestion?: unknown
  characterId?: unknown
}

interface RawResponse {
  issues?: unknown
}

function validate(raw: unknown): ConsistencyIssue[] {
  const root = raw as RawResponse
  const list = Array.isArray(root?.issues) ? root.issues : []
  const out: ConsistencyIssue[] = []
  for (const item of list as RawIssue[]) {
    if (typeof item?.title !== 'string' || typeof item?.detail !== 'string')
      continue
    const kind = VALID_KINDS.includes(item.kind as ConsistencyIssueKind)
      ? (item.kind as ConsistencyIssueKind)
      : 'other'
    const severity = VALID_SEVERITIES.includes(item.severity as ConsistencyIssueSeverity)
      ? (item.severity as ConsistencyIssueSeverity)
      : 'warn'
    out.push({
      kind,
      severity,
      title: item.title.trim(),
      detail: item.detail.trim(),
      suggestion: typeof item.suggestion === 'string' ? item.suggestion.trim() : undefined,
      characterId: typeof item.characterId === 'string' ? item.characterId.trim() : undefined,
    })
  }
  return out
}

/**
 * Returns the issue list (possibly empty when the chapter passes review)
 * or a structured error.
 */
export async function checkChapterConsistency(
  opts: CheckConsistencyOptions,
): Promise<AiAuthoringResult<ConsistencyIssue[]>> {
  const prompt = buildPrompt(opts)
  return runAiJsonExtractionResult<ConsistencyIssue[]>(
    { prompt, maxTokens: 1500, temperature: 0.3 },
    validate,
    1,
  )
}

export const __internal = { buildPrompt, validate }
