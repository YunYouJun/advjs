/**
 * Phase 16 — 角色互动模拟（AI 自演）。
 *
 * 给定一组角色 + 场景目标，让 AI 轮流扮演每个角色，产出一段对话脚本。
 * 与 useGroupChatStore 的关键差异：
 *   - 不依赖持久化 room，纯一次性模拟
 *   - 输出转换为 AdvScript 片段，便于作者粘贴入章节
 *   - 简化的轮转：round-robin（避免 AI selectNextSpeaker 的额外开销）
 */

import type { AdvCharacter } from '@advjs/types'
import type { AiAuthoringResult } from './result'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { buildStreamOptions, streamChat } from '../aiClient'
import { classifyError, fail, notConfiguredError, ok } from './result'

export interface RoleplayLine {
  speakerId: string
  speakerName: string
  content: string
}

export interface SimulateRoleplayOptions {
  characters: AdvCharacter[]
  goal: string
  worldMd?: string
  rounds?: number
  signal?: AbortSignal
  onLine?: (line: RoleplayLine) => void
}

function buildLinePrompt(opts: {
  speaker: AdvCharacter
  others: AdvCharacter[]
  worldMd: string
  goal: string
  history: RoleplayLine[]
}): string {
  const others = opts.others.map(c => `  - @${c.id}（${c.name}）`).join('\n')
  const historyLines = opts.history.length === 0
    ? '（场景开始）'
    : opts.history.map(h => `${h.speakerName}：${h.content}`).join('\n')

  return [
    `你正在扮演角色「${opts.speaker.name}」（@${opts.speaker.id}）。`,
    opts.speaker.personality ? `性格：${opts.speaker.personality}` : '',
    opts.speaker.appearance ? `外貌：${opts.speaker.appearance}` : '',
    opts.speaker.background ? `背景：${opts.speaker.background}` : '',
    ``,
    `# 世界设定`,
    opts.worldMd.trim() || '（无）',
    ``,
    `# 场景目标`,
    opts.goal,
    ``,
    `# 同场其他角色`,
    others || '  （独角戏）',
    ``,
    `# 已发生的对话`,
    historyLines,
    ``,
    `# 要求`,
    `- 只输出「${opts.speaker.name}」此刻该说的一句对白，最多 60 字；`,
    `- 不要输出角色名前缀、不要带引号、不要解释；`,
    `- 保持角色一致性，符合场景目标推进；`,
  ].filter(Boolean).join('\n')
}

/**
 * Run an AI-driven roleplay simulation. Returns the transcript array
 * (partial success counts as success) or a structured error.
 *
 * Per-round errors are tolerated and the loop continues, but if the run
 * yields zero lines we surface the last error so the UI can offer retry.
 */
export async function simulateRoleplay(
  opts: SimulateRoleplayOptions,
): Promise<AiAuthoringResult<RoleplayLine[]>> {
  const aiSettings = useAiSettingsStore()
  if (!aiSettings.isConfigured)
    return fail(notConfiguredError())
  if (opts.characters.length === 0)
    return fail({ type: 'unknown', message: 'No characters provided', retryable: false })

  const rounds = Math.max(1, Math.min(opts.rounds ?? 6, 20))
  const lines: RoleplayLine[] = []
  const worldMd = opts.worldMd ?? ''
  let lastError: unknown = null

  for (let i = 0; i < rounds; i++) {
    if (opts.signal?.aborted)
      break
    const speaker = opts.characters[i % opts.characters.length]
    const others = opts.characters.filter(c => c.id !== speaker.id)
    const prompt = buildLinePrompt({
      speaker,
      others,
      worldMd,
      goal: opts.goal,
      history: lines,
    })

    const streamOptions = buildStreamOptions(
      [
        { role: 'system', content: 'You are an actor playing a character in an interactive fiction. Output a single line only.' },
        { role: 'user', content: prompt },
      ],
      aiSettings.config,
      aiSettings.effectiveBaseURL,
      aiSettings.effectiveModel,
      opts.signal,
    )
    streamOptions.maxTokens = 200
    streamOptions.temperature = 0.85

    let accumulated = ''
    try {
      for await (const delta of streamChat(streamOptions))
        accumulated += delta
    }
    catch (err) {
      lastError = err
      const classified = classifyError(err)
      // Abort / auth / not_found: stop the whole sim immediately
      if (classified.type === 'aborted' || classified.type === 'auth' || classified.type === 'not_found')
        break
      // Otherwise skip this turn and try the next round
      continue
    }

    const content = accumulated.trim().replace(/^["'「『]/, '').replace(/["'」』]$/, '')
    if (!content)
      continue

    const line: RoleplayLine = {
      speakerId: speaker.id,
      speakerName: speaker.name,
      content,
    }
    lines.push(line)
    opts.onLine?.(line)
  }

  if (lines.length > 0)
    return ok(lines)
  if (lastError !== null)
    return fail(classifyError(lastError))
  // Aborted before producing any line
  return fail({ type: 'aborted', message: 'aborted', retryable: false })
}

/**
 * Convert a roleplay transcript to an AdvScript snippet (without scene header).
 */
export function transcriptToAdvScript(lines: RoleplayLine[]): string {
  return lines
    .map(l => `@${l.speakerId}\n${l.content}`)
    .join('\n\n')
}

export const __internal = { buildLinePrompt }
