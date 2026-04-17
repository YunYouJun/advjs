/**
 * Shared AI JSON extraction pipeline.
 * Encapsulates the "check config -> build messages -> stream -> parse" flow
 * used by memory and state extraction stores.
 */

import type { ChatMessage as AiChatMessage } from './aiClient'
import { useCharacterMemoryStore } from '../stores/useCharacterMemoryStore'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
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
