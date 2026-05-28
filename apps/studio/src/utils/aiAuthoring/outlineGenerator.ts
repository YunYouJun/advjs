/**
 * Phase 16 — AI 大纲生成。
 *
 * 流式调用 LLM 生成 outline.md（纯 Markdown，不走 JSON）。
 */

import type { AdvCharacter } from '@advjs/types'
import type { BuildOutlinePromptInput } from './prompts'
import type { AiAuthoringResult } from './result'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { buildStreamOptions, streamChat } from '../aiClient'
import { buildOutlinePrompt } from './prompts'
import { classifyError, fail, notConfiguredError, ok } from './result'

export interface GenerateOutlineOptions {
  worldMd: string
  characters: AdvCharacter[]
  hint?: string
  signal?: AbortSignal
  /** Called for each incoming delta chunk. */
  onChunk?: (delta: string) => void
}

export interface GenerateOutlineResult {
  text: string
  prompt: string
}

/**
 * Returns the full generated Markdown or a structured error.
 */
export async function generateOutline(
  opts: GenerateOutlineOptions,
): Promise<AiAuthoringResult<GenerateOutlineResult>> {
  const aiSettings = useAiSettingsStore()
  if (!aiSettings.isConfigured)
    return fail(notConfiguredError())

  const promptInput: BuildOutlinePromptInput = {
    worldMd: opts.worldMd,
    characters: opts.characters,
    hint: opts.hint,
  }
  const prompt = buildOutlinePrompt(promptInput)

  const streamOptions = buildStreamOptions(
    [
      { role: 'system', content: 'You are a helpful interactive fiction writer assistant. Output Markdown only.' },
      { role: 'user', content: prompt },
    ],
    aiSettings.config,
    aiSettings.effectiveBaseURL,
    aiSettings.effectiveModel,
    opts.signal,
  )
  streamOptions.maxTokens = 2000
  streamOptions.temperature = 0.7

  let accumulated = ''
  try {
    for await (const delta of streamChat(streamOptions)) {
      accumulated += delta
      opts.onChunk?.(delta)
    }
  }
  catch (err) {
    return fail(classifyError(err))
  }

  return ok({ text: accumulated.trim(), prompt })
}
