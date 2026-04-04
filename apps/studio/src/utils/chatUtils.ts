/**
 * Shared utilities for AI chat features.
 */

import type { Ref } from 'vue'
import i18n from '../i18n'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { AiApiError, buildStreamOptions, streamChat } from './aiClient'

/** Strip markdown code fences from AI responses (e.g. ```json\n...\n```) */
export const CODE_FENCE_START_RE = /^```(?:json)?\n?/
export const CODE_FENCE_END_RE = /\n?```$/

/** Match a markdown/md fenced code block and capture its content */
export const MARKDOWN_FENCE_RE = /```(?:markdown|md)?\n([\s\S]*?)```/

/**
 * Extract markdown content from AI output (strip code fences).
 * If wrapped in a ```markdown or ```md block, returns the inner content;
 * otherwise returns the trimmed input.
 */
export function extractMarkdown(text: string): string {
  const trimmed = text.trim()
  const match = MARKDOWN_FENCE_RE.exec(trimmed)
  return match ? match[1].trim() : trimmed
}

/**
 * Format a chat message timestamp as HH:MM.
 * Used by ChatPage, CharacterChatPage, and GroupChatPage.
 */
export function formatChatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Map of mood keyword → emoji.
 * Used in CharacterCard and CharacterChatPage.
 */
const MOOD_EMOJI_MAP: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  curious: '🤔',
  worried: '😟',
  excited: '🤩',
  calm: '😌',
  neutral: '😐',
  shy: '😳',
  amused: '😄',
  surprised: '😲',
  loving: '🥰',
  thoughtful: '🤨',
  playful: '😜',
  tired: '😴',
  fearful: '😨',
}

/**
 * Returns the emoji for a given mood keyword.
 * Falls back to '😐' if unknown.
 */
export function getMoodEmoji(mood: string): string {
  return MOOD_EMOJI_MAP[mood] || '😐'
}

/**
 * Map of knowledge domain keyword → emoji.
 * Matching is case-insensitive substring match.
 * Used in CharacterCard and KnowledgeManageModal.
 */
const DOMAIN_ICON_MAP: Array<[string, string]> = [
  ['法律', '⚖️'],
  ['law', '⚖️'],
  ['医学', '🏥'],
  ['medicine', '🏥'],
  ['medical', '🏥'],
  ['心理', '🧠'],
  ['psychology', '🧠'],
  ['金融', '💰'],
  ['finance', '💰'],
  ['科技', '💻'],
  ['technology', '💻'],
  ['tech', '💻'],
  ['教育', '📚'],
  ['education', '📚'],
]

/**
 * Parse an AI response that is expected to contain JSON.
 * Strips code fences, parses JSON, then validates/transforms via the provided function.
 * Returns `null` if parsing or validation fails.
 */
export function parseAiJson<T>(
  response: string,
  validate: (raw: any) => T,
): T | null {
  try {
    const cleaned = response
      .replace(CODE_FENCE_START_RE, '')
      .replace(CODE_FENCE_END_RE, '')
      .trim()
    return validate(JSON.parse(cleaned))
  }
  catch {
    return null
  }
}

/**
 * Returns the emoji icon for a given knowledge domain string.
 * Falls back to '🎓' if no match.
 */
export function getDomainIcon(domain: string): string {
  const lower = domain.toLowerCase()
  for (const [key, icon] of DOMAIN_ICON_MAP) {
    if (lower.includes(key))
      return icon
  }
  return '🎓'
}

/**
 * Map an AI-related error to a user-facing i18n message string.
 * Handles AiApiError subtypes, AbortError, and generic errors.
 */
export function getAiErrorMessage(err: unknown): string {
  if (err instanceof AiApiError) {
    const key = ({
      auth: 'errorAuth',
      rate_limit: 'errorRateLimit',
      network: 'errorNetwork',
      timeout: 'errorTimeout',
    } as Record<string, string>)[err.type]
    return key ? i18n.global.t(`chat.${key}`) : i18n.global.t('chat.errorGeneric', { message: err.message })
  }
  if (err instanceof DOMException && err.name === 'AbortError')
    return i18n.global.t('chat.errorAborted')
  return i18n.global.t('chat.errorUnexpected', { message: err instanceof Error ? err.message : 'Unknown error' })
}

/**
 * Returns a valid displayable avatar URL, or empty string if invalid.
 * Accepts http(s), data:, and blob: URLs.
 */
export function getValidAvatarUrl(avatar?: string): string {
  if (!avatar)
    return ''
  if (avatar.startsWith('http') || avatar.startsWith('data:') || avatar.startsWith('blob:'))
    return avatar
  return ''
}

/**
 * Returns the first two characters of a name for use as avatar initials.
 */
export function getCharacterInitials(name?: string, fallback = '?'): string {
  return (name || fallback).slice(0, 2)
}

/**
 * Abort the current controller and set the ref to null.
 * Shared by store `stopGeneration()` implementations.
 */
export function abortAndClear(controller: Ref<AbortController | null>): void {
  if (controller.value) {
    controller.value.abort()
    controller.value = null
  }
}

/**
 * Handle a streaming error in a chat store:
 * clear streaming state and set error message on the placeholder message
 * (preserving any partial content already streamed).
 */
export function handleStreamError(
  err: unknown,
  streamingContent: Ref<string>,
  messages: Array<{ content: string, [key: string]: unknown }>,
  msgIndex: number,
): void {
  streamingContent.value = ''
  const errorMessage = getAiErrorMessage(err)
  const msg = messages[msgIndex]
  if (msg)
    messages[msgIndex] = { ...msg, content: msg.content || errorMessage }
}

/**
 * Push a "not configured" fallback assistant message after a short delay.
 * Used by useChatStore and useCharacterChatStore.
 */
export function pushNotConfiguredFallback(
  messages: Array<{ role: string, content: string, timestamp: number }>,
  isLoading: Ref<boolean>,
): void {
  isLoading.value = true
  setTimeout(() => {
    messages.push({
      role: 'assistant',
      content: i18n.global.t('chat.aiNotConfiguredMessage'),
      timestamp: Date.now(),
    })
    isLoading.value = false
  }, 300)
}

/**
 * Shared streaming pipeline for useChatStore and useCharacterChatStore.
 *
 * Handles: abort controller setup → placeholder message → buildStreamOptions →
 * for-await streamChat → accumulate to streamingContent + message →
 * handleStreamError catch → finally cleanup.
 *
 * `onSuccess` lets the caller run post-processing (e.g. background extraction)
 * after a successful stream completes.
 *
 * NOTE: useGroupChatStore is intentionally excluded because its catch/finally
 * blocks contain extra logic (selectingSpeaker, currentSpeakerName cleanup)
 * and its placeholder messages have additional fields (characterId, characterName).
 */
export async function streamToMessage(opts: {
  allMessages: Array<{ role: string, content: string }>
  messageList: Array<{ role: string, content: string, timestamp: number }>
  placeholderRole: string
  streamingContent: Ref<string>
  isLoading: Ref<boolean>
  currentAbortController: Ref<AbortController | null>
  onSuccess?: (accumulated: string) => void
}): Promise<void> {
  const aiSettings = useAiSettingsStore()
  const abortController = new AbortController()
  opts.currentAbortController.value = abortController

  // Add a placeholder message for streaming
  opts.messageList.push({
    role: opts.placeholderRole,
    content: '',
    timestamp: Date.now(),
  })
  const msgIndex = opts.messageList.length - 1

  try {
    const options = buildStreamOptions(
      opts.allMessages,
      aiSettings.config,
      aiSettings.effectiveBaseURL,
      aiSettings.effectiveModel,
      abortController.signal,
    )

    let accumulated = ''
    for await (const delta of streamChat(options)) {
      accumulated += delta
      opts.streamingContent.value = accumulated
      opts.messageList[msgIndex].content = accumulated
    }

    opts.streamingContent.value = ''
    opts.onSuccess?.(accumulated)
  }
  catch (err) {
    handleStreamError(err, opts.streamingContent, opts.messageList, msgIndex)
  }
  finally {
    opts.isLoading.value = false
    opts.currentAbortController.value = null
  }
}
