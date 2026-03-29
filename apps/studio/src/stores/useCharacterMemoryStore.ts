import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { buildStreamOptions, streamChat } from '../utils/aiClient'
import { CODE_FENCE_END_RE, CODE_FENCE_START_RE } from '../utils/chatUtils'
import { useAiSettingsStore } from './useAiSettingsStore'

export interface MemoryKeyEvent {
  /** Brief summary of what happened */
  summary: string
  timestamp: number
}

export interface UserProfileEntry {
  /** What the character knows about the user (e.g. "likes cats", "is a student") */
  key: string
  value: string
}

export interface EmotionalState {
  /** Overall affinity toward user, -100 (hostile) to 100 (devoted) */
  affinity: number
  /** Trust level, 0 (suspicious) to 100 (complete trust) */
  trust: number
  /** Current mood keyword */
  mood: string
}

export interface CharacterMemory {
  characterId: string
  keyEvents: MemoryKeyEvent[]
  userProfile: UserProfileEntry[]
  emotionalState: EmotionalState
}

const STORAGE_KEY = 'advjs-studio-character-memories'
const MAX_KEY_EVENTS = 50

function createDefaultEmotionalState(): EmotionalState {
  return { affinity: 0, trust: 20, mood: 'neutral' }
}

/**
 * Build the extraction prompt that asks AI to analyze a conversation turn
 * and extract structured memory updates.
 */
function buildMemoryExtractionPrompt(
  characterName: string,
  userMessage: string,
  assistantMessage: string,
  currentMemory: CharacterMemory,
): string {
  const currentProfile = currentMemory.userProfile.length > 0
    ? currentMemory.userProfile.map(p => `- ${p.key}: ${p.value}`).join('\n')
    : '(empty)'

  const recentEvents = currentMemory.keyEvents
    .slice(-5)
    .map(e => `- ${e.summary}`)
    .join('\n') || '(none)'

  return `You are a memory extraction system for the character "${characterName}".
Analyze this conversation turn and extract structured updates.

## Current Memory State
Affinity: ${currentMemory.emotionalState.affinity}, Trust: ${currentMemory.emotionalState.trust}, Mood: ${currentMemory.emotionalState.mood}

Known user info:
${currentProfile}

Recent events:
${recentEvents}

## Latest Turn
User: ${userMessage}
${characterName}: ${assistantMessage}

## Task
Return a JSON object with these fields (all optional, only include if there are updates):
- "keyEvent": string | null — A brief summary of this exchange if it's memorable (null if routine)
- "userInfo": { "key": string, "value": string }[] — New facts learned about the user (empty array if none)
- "affinity_delta": number — Change to affinity (-10 to +10, 0 if neutral)
- "trust_delta": number — Change to trust (-5 to +5, 0 if neutral)
- "mood": string — Character's current mood after this exchange (e.g. "happy", "curious", "worried")

Return ONLY the JSON object, no markdown fencing or explanation.`
}

/**
 * Parse the AI's memory extraction response into structured data.
 */
function parseMemoryExtraction(response: string): {
  keyEvent: string | null
  userInfo: { key: string, value: string }[]
  affinity_delta: number
  trust_delta: number
  mood: string
} | null {
  try {
    // Strip any markdown code fences if present
    const cleaned = response.replace(CODE_FENCE_START_RE, '').replace(CODE_FENCE_END_RE, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      keyEvent: parsed.keyEvent || null,
      userInfo: Array.isArray(parsed.userInfo) ? parsed.userInfo : [],
      affinity_delta: typeof parsed.affinity_delta === 'number' ? parsed.affinity_delta : 0,
      trust_delta: typeof parsed.trust_delta === 'number' ? parsed.trust_delta : 0,
      mood: typeof parsed.mood === 'string' ? parsed.mood : 'neutral',
    }
  }
  catch {
    return null
  }
}

export const useCharacterMemoryStore = defineStore('characterMemory', () => {
  const memories = ref<Map<string, CharacterMemory>>(new Map())

  // Load from localStorage on init
  loadFromStorage()

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: [string, CharacterMemory][] = JSON.parse(saved)
        memories.value = new Map(parsed)
      }
    }
    catch {
      // ignore
    }
  }

  function saveToStorage() {
    try {
      const entries = Array.from(memories.value.entries())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    }
    catch {
      // ignore
    }
  }

  // Persist on change
  watch(memories, () => {
    saveToStorage()
  }, { deep: true })

  function getMemory(characterId: string): CharacterMemory {
    if (!memories.value.has(characterId)) {
      memories.value.set(characterId, {
        characterId,
        keyEvents: [],
        userProfile: [],
        emotionalState: createDefaultEmotionalState(),
      })
    }
    return memories.value.get(characterId)!
  }

  /**
   * Format memory for injection into system prompt.
   */
  function formatMemoryForPrompt(characterId: string): string {
    const memory = getMemory(characterId)

    // Only return content if there is actual memory
    if (memory.userProfile.length === 0 && memory.keyEvents.length === 0) {
      return ''
    }

    const parts: string[] = []

    // Header + emotional state
    parts.push('# 角色记忆')
    parts.push('')
    parts.push(`当前情感状态：好感度 ${memory.emotionalState.affinity}/100，信任度 ${memory.emotionalState.trust}/100，心情：${memory.emotionalState.mood}`)
    parts.push('')

    // User profile
    if (memory.userProfile.length > 0) {
      parts.push('## 已知的用户信息')
      parts.push('')
      for (const entry of memory.userProfile) {
        parts.push(`- ${entry.key}: ${entry.value}`)
      }
      parts.push('')
    }

    // Recent key events (last 10)
    if (memory.keyEvents.length > 0) {
      parts.push('## 过往重要事件')
      parts.push('')
      const recent = memory.keyEvents.slice(-10)
      for (const event of recent) {
        parts.push(`- ${event.summary}`)
      }
      parts.push('')
    }

    return parts.join('\n')
  }

  /**
   * Extract and update memories after a conversation turn.
   * This runs in the background and does not block the UI.
   */
  async function extractMemoryFromTurn(
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

    const memory = getMemory(characterId)
    const prompt = buildMemoryExtractionPrompt(characterName, userMessage, assistantMessage, memory)

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
      // Override to use lower tokens for extraction
      options.maxTokens = 300
      options.temperature = 0.3

      let accumulated = ''
      for await (const delta of streamChat(options)) {
        accumulated += delta
      }

      const extraction = parseMemoryExtraction(accumulated)
      if (!extraction)
        return

      // Apply updates
      if (extraction.keyEvent) {
        memory.keyEvents.push({
          summary: extraction.keyEvent,
          timestamp: Date.now(),
        })
        // Trim to max
        if (memory.keyEvents.length > MAX_KEY_EVENTS) {
          memory.keyEvents = memory.keyEvents.slice(-MAX_KEY_EVENTS)
        }
      }

      for (const info of extraction.userInfo) {
        // Update existing or add new
        const existing = memory.userProfile.find(p => p.key === info.key)
        if (existing) {
          existing.value = info.value
        }
        else {
          memory.userProfile.push(info)
        }
      }

      // Clamp emotional state
      memory.emotionalState.affinity = Math.max(
        -100,
        Math.min(100, memory.emotionalState.affinity + extraction.affinity_delta),
      )
      memory.emotionalState.trust = Math.max(
        0,
        Math.min(100, memory.emotionalState.trust + extraction.trust_delta),
      )
      memory.emotionalState.mood = extraction.mood
    }
    catch {
      // Memory extraction is best-effort, don't disrupt the chat
    }
  }

  function clearMemory(characterId: string) {
    memories.value.set(characterId, {
      characterId,
      keyEvents: [],
      userProfile: [],
      emotionalState: createDefaultEmotionalState(),
    })
  }

  return {
    memories,
    getMemory,
    formatMemoryForPrompt,
    extractMemoryFromTurn,
    clearMemory,
  }
})
