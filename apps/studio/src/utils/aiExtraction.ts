/**
 * Shared AI JSON extraction pipeline.
 * Encapsulates the "check config -> build messages -> stream -> parse" flow
 * used by memory and state extraction stores.
 */

import type { AiAuthoringResult } from './aiAuthoring/result'
import type { ChatMessage as AiChatMessage } from './aiClient'
import { useCharacterMemoryStore } from '../stores/useCharacterMemoryStore'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
import { classifyError, fail, notConfiguredError, ok } from './aiAuthoring/result'
import { buildStreamOptions, streamChat } from './aiClient'
import { parseAiJson } from './chatUtils'

export interface AiExtractionOptions {
  prompt: string
  maxTokens?: number
  temperature?: number
}

/**
 * Run a JSON extraction against the AI API.
 * Returns `null` if AI is not configured, the stream fails, or parsing fails.
 * @param options - Extraction options (prompt, maxTokens, temperature)
 * @param validate - Validation/transform function applied to the parsed JSON
 * @param retries - Number of additional attempts after the first try (default: 0)
 */
export async function runAiJsonExtraction<T>(
  options: AiExtractionOptions,
  validate: (raw: any) => T,
  retries = 0,
): Promise<T | null> {
  const { useAiSettingsStore } = await import('../stores/useAiSettingsStore')
  const aiSettings = useAiSettingsStore()
  if (!aiSettings.isConfigured)
    return null

  const messages: AiChatMessage[] = [
    { role: 'system', content: 'You are a JSON extraction system. Return only valid JSON.' },
    { role: 'user', content: options.prompt },
  ]

  const streamOptions = buildStreamOptions(
    messages,
    aiSettings.config,
    aiSettings.effectiveBaseURL,
    aiSettings.effectiveModel,
  )
  streamOptions.maxTokens = options.maxTokens ?? 300
  streamOptions.temperature = options.temperature ?? 0.3

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let accumulated = ''
      for await (const delta of streamChat(streamOptions))
        accumulated += delta

      const result = parseAiJson(accumulated, validate)
      if (result !== null)
        return result
      // JSON parse/validate failed — retry if attempts remain
    }
    catch {
      if (attempt === retries)
        return null
    }
  }

  return null
}

/**
 * Result-typed variant of `runAiJsonExtraction`.
 *
 * Used by Phase 16 aiAuthoring/* tools where the caller needs to display
 * structured error info (auth / rate_limit / network / timeout / aborted)
 * in the UI. Returns `{ data }` on success or `{ error }` on failure.
 *
 * Unlike `runAiJsonExtraction` which silently returns null on JSON parse
 * failure, this variant treats parse failures (after all retries) as
 * 'unknown' errors that are retryable.
 */
export async function runAiJsonExtractionResult<T>(
  options: AiExtractionOptions,
  validate: (raw: any) => T,
  retries = 0,
): Promise<AiAuthoringResult<T>> {
  const { useAiSettingsStore } = await import('../stores/useAiSettingsStore')
  const aiSettings = useAiSettingsStore()
  if (!aiSettings.isConfigured)
    return fail(notConfiguredError())

  const messages: AiChatMessage[] = [
    { role: 'system', content: 'You are a JSON extraction system. Return only valid JSON.' },
    { role: 'user', content: options.prompt },
  ]

  const streamOptions = buildStreamOptions(
    messages,
    aiSettings.config,
    aiSettings.effectiveBaseURL,
    aiSettings.effectiveModel,
  )
  streamOptions.maxTokens = options.maxTokens ?? 300
  streamOptions.temperature = options.temperature ?? 0.3

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let accumulated = ''
      for await (const delta of streamChat(streamOptions))
        accumulated += delta

      const parsed = parseAiJson(accumulated, validate)
      if (parsed !== null)
        return ok(parsed)
      // JSON parse/validate failed — track error, retry if attempts remain
      lastError = new Error('AI returned malformed JSON')
    }
    catch (err) {
      lastError = err
      // Don't retry auth / aborted / not_found
      const classified = classifyError(err)
      if (!classified.retryable || classified.type === 'aborted') {
        return fail(classified)
      }
    }
  }

  return fail(classifyError(lastError))
}

/**
 * Guard: returns true if the message should be skipped for extraction
 * (empty, too short, or an error/system message).
 */
export function shouldSkipExtraction(message: string): boolean {
  return !message || message.length < 10
    || message.startsWith('⚠️') || message.startsWith('🔑') || message.startsWith('❌')
}

/**
 * Trigger background memory + state extraction for a character conversation turn.
 * Silently skips if aiResponse is empty.
 */
export async function triggerBackgroundExtraction(
  characterId: string,
  characterName: string,
  userMessage: string,
  aiResponse: string,
): Promise<void> {
  if (!aiResponse)
    return
  const memoryStore = useCharacterMemoryStore()
  const stateStore = useCharacterStateStore()
  memoryStore.extractMemoryFromTurn(characterId, characterName, userMessage, aiResponse)
  stateStore.extractStateFromTurn(characterId, characterName, userMessage, aiResponse)
}
