/**
 * Phase 16 — Agent 工具化。
 *
 * 把 Studio 内 AI 创作能力（大纲 / 章节草稿 / 剧情提议 / 角色互动 / 一致性守门）
 * 注册为一个统一的工具表，便于对内调用与未来对外暴露给 MCP / Claude Agent SDK。
 *
 * 当前是纯内部 registry：UI 模块照常 import 各 generator；
 * 此处提供「按 id 调用」+「能力枚举」入口，方便后续接入 useAgentTool / MCP server。
 */

import type { GenerateChapterDraftOptions, GenerateChapterDraftResult } from './chapterDraftGenerator'
import type { CheckConsistencyOptions, ConsistencyIssue } from './consistencyChecker'
import type { GenerateOutlineOptions, GenerateOutlineResult } from './outlineGenerator'
import type { PlotSuggestion, SuggestPlotOptions } from './plotSuggester'
import type { AiAuthoringResult } from './result'
import type { RoleplayLine, SimulateRoleplayOptions } from './roleplaySimulator'
import { generateChapterDraft } from './chapterDraftGenerator'
import { checkChapterConsistency } from './consistencyChecker'
import { generateOutline } from './outlineGenerator'
import { suggestPlot } from './plotSuggester'
import { simulateRoleplay } from './roleplaySimulator'

export type AgentToolId
  = | 'generate-outline'
    | 'generate-chapter-draft'
    | 'suggest-plot'
    | 'simulate-roleplay'
    | 'check-consistency'

export type AgentToolCategory = 'planning' | 'drafting' | 'review'

export interface AgentToolMeta {
  id: AgentToolId
  category: AgentToolCategory
  /** Short human-readable name (English; UI surfaces use i18n separately) */
  name: string
  description: string
  streaming: boolean
}

export const AGENT_TOOL_META: Readonly<Record<AgentToolId, AgentToolMeta>> = Object.freeze({
  'generate-outline': {
    id: 'generate-outline',
    category: 'planning',
    name: 'Generate Story Outline',
    description: 'Produce a multi-chapter outline (Markdown) from world.md and character cards.',
    streaming: true,
  },
  'generate-chapter-draft': {
    id: 'generate-chapter-draft',
    category: 'drafting',
    name: 'Draft Chapter Body',
    description: 'Stream AdvScript body for a specific chapter with selected characters.',
    streaming: true,
  },
  'suggest-plot': {
    id: 'suggest-plot',
    category: 'planning',
    name: 'Suggest Plot Branches',
    description: 'Return 3 distinct plot directions for the next chapter based on current state.',
    streaming: false,
  },
  'simulate-roleplay': {
    id: 'simulate-roleplay',
    category: 'drafting',
    name: 'Simulate Roleplay',
    description: 'Run an AI roleplay simulation among selected characters toward a stated goal.',
    streaming: true,
  },
  'check-consistency': {
    id: 'check-consistency',
    category: 'review',
    name: 'Check Chapter Consistency',
    description: 'Audit a chapter body for character drift, timeline issues, and unresolved foreshadowing.',
    streaming: false,
  },
})

export interface AgentToolInputMap {
  'generate-outline': GenerateOutlineOptions
  'generate-chapter-draft': GenerateChapterDraftOptions
  'suggest-plot': SuggestPlotOptions
  'simulate-roleplay': SimulateRoleplayOptions
  'check-consistency': CheckConsistencyOptions
}

export interface AgentToolResultMap {
  'generate-outline': AiAuthoringResult<GenerateOutlineResult>
  'generate-chapter-draft': AiAuthoringResult<GenerateChapterDraftResult>
  'suggest-plot': AiAuthoringResult<PlotSuggestion[]>
  'simulate-roleplay': AiAuthoringResult<RoleplayLine[]>
  'check-consistency': AiAuthoringResult<ConsistencyIssue[]>
}

const HANDLERS: { [K in AgentToolId]: (input: AgentToolInputMap[K]) => Promise<AgentToolResultMap[K]> } = {
  'generate-outline': generateOutline,
  'generate-chapter-draft': generateChapterDraft,
  'suggest-plot': suggestPlot,
  'simulate-roleplay': simulateRoleplay,
  'check-consistency': checkChapterConsistency,
}

/**
 * Enumerate all registered AI authoring tools (sorted by category, then id).
 */
export function listAgentTools(): AgentToolMeta[] {
  return Object.values(AGENT_TOOL_META)
    .slice()
    .sort((a, b) =>
      a.category === b.category
        ? a.id.localeCompare(b.id)
        : a.category.localeCompare(b.category),
    )
}

/**
 * Look up a tool's metadata, or undefined if the id is unknown.
 */
export function getAgentTool(id: string): AgentToolMeta | undefined {
  return (AGENT_TOOL_META as Record<string, AgentToolMeta>)[id]
}

/**
 * Type-safe agent tool invocation. Strictly equivalent to calling the
 * underlying generator directly; routed through this entry so callers
 * (future MCP server, external SDK) can address tools by string id.
 *
 * Always async — unknown ids surface as a rejected promise so consumers
 * have one unified error path.
 */
export async function invokeAgentTool<K extends AgentToolId>(
  id: K,
  input: AgentToolInputMap[K],
): Promise<AgentToolResultMap[K]> {
  const handler = HANDLERS[id]
  if (!handler)
    throw new Error(`Unknown agent tool: ${String(id)}`)
  return (await handler(input)) as AgentToolResultMap[K]
}
