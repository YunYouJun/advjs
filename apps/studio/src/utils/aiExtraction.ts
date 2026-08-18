/**
 * Shared AI JSON extraction pipeline.
 * Encapsulates the "check config -> build messages -> stream -> parse" flow
 * used by memory and state extraction stores.
 */

import type { AiAuthoringResult } from './aiAuthoring/result'
import { fail, notConfiguredError } from './aiAuthoring/result'

export interface AiExtractionOptions {
  prompt: string
  maxTokens?: number
  temperature?: number
}

/**
 * Legacy extraction compatibility seam. Managed extraction is not registered,
 * so production callers fail closed without issuing a provider request.
 */
export async function runAiJsonExtraction<T>(
  _options: AiExtractionOptions,
  _validate: (raw: any) => T,
  _retries = 0,
): Promise<T | null> {
  // No provider fallback: unregistered extraction capabilities fail closed.
  return null
}

/**
 * Result-typed variant of `runAiJsonExtraction`.
 *
 * Result-typed compatibility seam for callers that need a stable unavailable
 * error while the managed capability remains unregistered.
 */
export async function runAiJsonExtractionResult<T>(
  _options: AiExtractionOptions,
  _validate: (raw: any) => T,
  _retries = 0,
): Promise<AiAuthoringResult<T>> {
  return fail(notConfiguredError())
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
  _characterId: string,
  _characterName: string,
  _userMessage: string,
  _aiResponse: string,
): Promise<void> {
  // Managed extraction is not registered yet.
}
