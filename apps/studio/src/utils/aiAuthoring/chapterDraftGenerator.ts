/**
 * Phase 16 — AI 章节正文草拟。
 *
 * 流式调用 LLM，返回 AdvScript 正文（不含 frontmatter）。
 */

import type { AdvCharacter } from '@advjs/types'
import type { ChapterFormData } from '../chapterMd'
import type { AiAuthoringResult } from './result'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { buildStreamOptions, streamChat } from '../aiClient'
import { buildChapterDraftPrompt } from './prompts'
import { classifyError, fail, notConfiguredError, ok } from './result'

export interface GenerateChapterDraftOptions {
  worldMd: string
  outlineMd: string
  chapter: ChapterFormData
  characters: AdvCharacter[]
  hint?: string
  signal?: AbortSignal
  onChunk?: (delta: string) => void
}

export interface GenerateChapterDraftResult {
  text: string
  prompt: string
}

export async function generateChapterDraft(
  opts: GenerateChapterDraftOptions,
): Promise<AiAuthoringResult<GenerateChapterDraftResult>> {
  const aiSettings = useAiSettingsStore()
  if (!aiSettings.isConfigured)
    return fail(notConfiguredError())

  const prompt = buildChapterDraftPrompt({
    worldMd: opts.worldMd,
    outlineMd: opts.outlineMd,
    chapterTitle: opts.chapter.title || opts.chapter.filename,
    chapterPlotSummary: opts.chapter.plotSummary,
    characters: opts.characters,
    hint: opts.hint,
  })

  const streamOptions = buildStreamOptions(
    [
      { role: 'system', content: 'You are a helpful interactive fiction writer assistant. Output AdvScript only.' },
      { role: 'user', content: prompt },
    ],
    aiSettings.config,
    aiSettings.effectiveBaseURL,
    aiSettings.effectiveModel,
    opts.signal,
  )
  streamOptions.maxTokens = 2500
  streamOptions.temperature = 0.8

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
