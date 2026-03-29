import type { AdvCharacterDynamicState } from '@advjs/types'
import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { buildStreamOptions, streamChat } from '../utils/aiClient'
import { CODE_FENCE_END_RE, CODE_FENCE_START_RE } from '../utils/chatUtils'
import { useAiSettingsStore } from './useAiSettingsStore'
import { useCharacterMemoryStore } from './useCharacterMemoryStore'

const STORAGE_KEY = 'advjs-studio-character-states'

function createDefaultState(): AdvCharacterDynamicState {
  return {
    lastUpdated: new Date().toISOString(),
  }
}

/**
 * Build the extraction prompt that asks AI to analyze a conversation turn
 * and extract world state changes (location, health, activity).
 */
function buildStateExtractionPrompt(
  characterName: string,
  userMessage: string,
  assistantMessage: string,
  currentState: AdvCharacterDynamicState,
): string {
  return `You are a world-state extraction system for the character "${characterName}".
Analyze this conversation turn and extract any world state changes.

## Current State
Location: ${currentState.location || '(unknown)'}
Health: ${currentState.health || '(unknown)'}
Activity: ${currentState.activity || '(unknown)'}

## Latest Turn
User: ${userMessage}
${characterName}: ${assistantMessage}

## Task
Return a JSON object with these fields (use null if no change detected):
- "location": string | null — Where the character is now (null if unchanged)
- "health": string | null — Character's health/physical state (null if unchanged)
- "activity": string | null — What the character is currently doing (null if unchanged)

Return ONLY the JSON object, no markdown fencing or explanation.`
}

/**
 * Parse the AI's state extraction response.
 */
function parseStateExtraction(response: string): {
  location: string | null
  health: string | null
  activity: string | null
} | null {
  try {
    const cleaned = response.replace(CODE_FENCE_START_RE, '').replace(CODE_FENCE_END_RE, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      location: typeof parsed.location === 'string' ? parsed.location : null,
      health: typeof parsed.health === 'string' ? parsed.health : null,
      activity: typeof parsed.activity === 'string' ? parsed.activity : null,
    }
  }
  catch {
    return null
  }
}

export const useCharacterStateStore = defineStore('characterState', () => {
  const states = ref<Map<string, AdvCharacterDynamicState>>(new Map())

  // Load from localStorage on init
  loadFromStorage()

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: [string, AdvCharacterDynamicState][] = JSON.parse(saved)
        states.value = new Map(parsed)
      }
    }
    catch {
      // ignore
    }
  }

  function saveToStorage() {
    try {
      const entries = Array.from(states.value.entries())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    }
    catch {
      // ignore
    }
  }

  // Persist on change
  watch(states, () => {
    saveToStorage()
  }, { deep: true })

  function getState(characterId: string): AdvCharacterDynamicState {
    if (!states.value.has(characterId)) {
      states.value.set(characterId, createDefaultState())
    }
    return states.value.get(characterId)!
  }

  function updateState(characterId: string, partial: Partial<AdvCharacterDynamicState>) {
    const current = getState(characterId)
    Object.assign(current, partial, { lastUpdated: new Date().toISOString() })
  }

  /**
   * Format state for injection into system prompt.
   * Reads mood from memory store + own location/health/activity.
   */
  function formatStateForPrompt(characterId: string): string {
    const state = getState(characterId)
    const memoryStore = useCharacterMemoryStore()
    const memory = memoryStore.getMemory(characterId)
    const mood = memory.emotionalState.mood

    const hasState = state.location || state.health || state.activity || mood !== 'neutral'
    if (!hasState)
      return ''

    const parts: string[] = [
      '# 角色当前状态',
      '',
    ]

    if (mood && mood !== 'neutral')
      parts.push(`- 心情：${mood}`)
    if (state.location)
      parts.push(`- 位置：${state.location}`)
    if (state.health)
      parts.push(`- 健康：${state.health}`)
    if (state.activity)
      parts.push(`- 活动：${state.activity}`)

    if (state.recentEvents && state.recentEvents.length > 0) {
      parts.push('')
      parts.push('## 最近事件')
      for (const event of state.recentEvents.slice(-5)) {
        parts.push(`- ${event}`)
      }
    }

    parts.push('')
    return parts.join('\n')
  }

  /**
   * Extract and update world state after a conversation turn.
   * This runs in the background and does not block the UI.
   */
  async function extractStateFromTurn(
    characterId: string,
    characterName: string,
    userMessage: string,
    assistantMessage: string,
  ) {
    // Don't extract from error messages or very short responses
    if (!assistantMessage || assistantMessage.length < 10 || assistantMessage.startsWith('⚠️') || assistantMessage.startsWith('🔑') || assistantMessage.startsWith('❌'))
      return

    const aiSettings = useAiSettingsStore()
    if (!aiSettings.isConfigured)
      return

    const state = getState(characterId)
    const prompt = buildStateExtractionPrompt(characterName, userMessage, assistantMessage, state)

    const messages: AiChatMessage[] = [
      { role: 'system', content: 'You are a JSON extraction system. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ]

    try {
      const options = buildStreamOptions(
        messages,
        aiSettings.config,
        aiSettings.effectiveBaseURL,
        aiSettings.effectiveModel,
      )
      // Low token extraction mode
      options.maxTokens = 200
      options.temperature = 0.3

      let accumulated = ''
      for await (const delta of streamChat(options)) {
        accumulated += delta
      }

      const extraction = parseStateExtraction(accumulated)
      if (!extraction)
        return

      // Apply updates (only non-null values)
      const updates: Partial<AdvCharacterDynamicState> = {}
      if (extraction.location !== null)
        updates.location = extraction.location
      if (extraction.health !== null)
        updates.health = extraction.health
      if (extraction.activity !== null)
        updates.activity = extraction.activity

      if (Object.keys(updates).length > 0) {
        updateState(characterId, updates)
      }
    }
    catch {
      // State extraction is best-effort, don't disrupt the chat
    }
  }

  function clearState(characterId: string) {
    states.value.set(characterId, createDefaultState())
  }

  return {
    states,
    getState,
    updateState,
    formatStateForPrompt,
    extractStateFromTurn,
    clearState,
  }
})
