import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import { runAiJsonExtraction, shouldSkipExtraction } from '../utils/aiExtraction'
import { db } from '../utils/db'
import { getOrCreateInMap, loadMapFromDexie, useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'
import { PromptBuilder } from '../utils/promptBuilder'

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

export interface EmotionalSnapshot {
  timestamp: number
  affinity: number
  trust: number
  mood: string
}

export interface CharacterMemory {
  characterId: string
  keyEvents: MemoryKeyEvent[]
  userProfile: UserProfileEntry[]
  emotionalState: EmotionalState
  /** Time-series emotional snapshots for trend visualization */
  emotionalHistory: EmotionalSnapshot[]
}

const MAX_KEY_EVENTS = 50
const MAX_EMOTIONAL_HISTORY = 200
const MAX_USER_PROFILE = 30

/** When keyEvents reaches this count, trigger AI compression */
const COMPRESSION_THRESHOLD = 40
/** After compression, keep this many recent events uncompressed */
const COMPRESSION_KEEP_RECENT = 15

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

export const useCharacterMemoryStore = defineStore('characterMemory', () => {
  const memories = ref<Map<string, CharacterMemory>>(new Map())

  // --- Dexie persistence ---

  const { flush, init, $reset } = useProjectPersistence({
    source: memories,
    save: async () => {
      const pid = getCurrentProjectId()
      const entries = Array.from(memories.value.entries())
      const rows = entries.map(([_, mem]) => ({ ...mem, projectId: pid }))
      await db.characterMemories.bulkPut(rows)
    },
    load: async (pid) => {
      const map = await loadMapFromDexie<CharacterMemory>(
        db.characterMemories,
        pid,
        row => row.characterId,
        row => row,
      )
      if (map)
        memories.value = map
    },
    clear: () => {
      memories.value = new Map()
    },
  })

  function getMemory(characterId: string): CharacterMemory {
    const mem = getOrCreateInMap(memories.value, characterId, id => ({
      characterId: id,
      keyEvents: [],
      userProfile: [],
      emotionalState: createDefaultEmotionalState(),
      emotionalHistory: [],
    }))
    // Backward compatibility: old data may lack emotionalHistory
    if (!mem.emotionalHistory)
      mem.emotionalHistory = []
    return mem
  }

  /**
   * Format memory for injection into system prompt.
   */
  function formatMemoryForPrompt(characterId: string): string {
    const memory = getMemory(characterId)

    // Only return content if there is actual memory
    const hasProfile = memory.userProfile.length > 0
    const hasEvents = memory.keyEvents.length > 0
    const es = memory.emotionalState
    const hasEmotionalChange = es.affinity !== 0 || es.trust !== 20 || es.mood !== 'neutral'
    if (!hasProfile && !hasEvents && !hasEmotionalChange) {
      return ''
    }

    const builder = new PromptBuilder()
      .line(i18n.global.t('systemPrompt.memory.header'))
      .line()
      .line(i18n.global.t('systemPrompt.memory.emotionalState', {
        affinity: memory.emotionalState.affinity,
        trust: memory.emotionalState.trust,
        mood: memory.emotionalState.mood,
      }))
      .line()

    if (memory.userProfile.length > 0) {
      builder
        .line(i18n.global.t('systemPrompt.memory.userProfileHeader'))
        .line()
        .items(memory.userProfile.map(entry => `- ${entry.key}: ${entry.value}`))
        .line()
    }

    if (memory.keyEvents.length > 0) {
      builder
        .line(i18n.global.t('systemPrompt.memory.keyEventsHeader'))
        .line()
        .items(memory.keyEvents.slice(-10).map(event => `- ${event.summary}`))
        .line()
    }

    return builder.build()
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
    if (shouldSkipExtraction(assistantMessage))
      return

    const memory = getMemory(characterId)
    const prompt = buildMemoryExtractionPrompt(characterName, userMessage, assistantMessage, memory)

    try {
      const extraction = await runAiJsonExtraction(
        { prompt, maxTokens: 300, temperature: 0.3 },
        parsed => ({
          keyEvent: parsed.keyEvent || null,
          userInfo: Array.isArray(parsed.userInfo) ? parsed.userInfo : [],
          affinity_delta: typeof parsed.affinity_delta === 'number' ? parsed.affinity_delta : 0,
          trust_delta: typeof parsed.trust_delta === 'number' ? parsed.trust_delta : 0,
          mood: typeof parsed.mood === 'string' ? parsed.mood : 'neutral',
        }),
        1,
      )
      if (!extraction)
        return

      // Apply updates
      if (extraction.keyEvent) {
        // Deduplicate: skip if a very similar event exists in the last 10 entries
        const recent = memory.keyEvents.slice(-10)
        const isDuplicate = recent.some((e) => {
          const a = e.summary.toLowerCase()
          const b = extraction.keyEvent!.toLowerCase()
          return a === b || (a.length > 20 && b.length > 20 && (a.includes(b) || b.includes(a)))
        })
        if (!isDuplicate) {
          memory.keyEvents.push({
            summary: extraction.keyEvent,
            timestamp: Date.now(),
          })
          // Trim to max
          if (memory.keyEvents.length > MAX_KEY_EVENTS) {
            memory.keyEvents = memory.keyEvents.slice(-MAX_KEY_EVENTS)
          }
        }
      }

      for (const info of extraction.userInfo) {
        if (!info.key || !info.value)
          continue
        // Update existing or add new
        const existing = memory.userProfile.find(p => p.key === info.key)
        if (existing) {
          existing.value = info.value
        }
        else {
          memory.userProfile.push(info)
        }
      }
      // Trim userProfile to cap (keep most recent entries)
      if (memory.userProfile.length > MAX_USER_PROFILE) {
        memory.userProfile = memory.userProfile.slice(-MAX_USER_PROFILE)
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

      // Record emotional snapshot for trend visualization
      memory.emotionalHistory.push({
        timestamp: Date.now(),
        affinity: memory.emotionalState.affinity,
        trust: memory.emotionalState.trust,
        mood: memory.emotionalState.mood,
      })
      if (memory.emotionalHistory.length > MAX_EMOTIONAL_HISTORY)
        memory.emotionalHistory = memory.emotionalHistory.slice(-MAX_EMOTIONAL_HISTORY)

      // Trigger background compression if events are accumulating
      if (memory.keyEvents.length >= COMPRESSION_THRESHOLD) {
        compressMemories(characterId).catch(() => {})
      }
    }
    catch (err) {
      // Memory extraction is best-effort, don't disrupt the chat
      console.warn(`[MemoryStore] extraction failed for ${characterId}:`, err)
    }
  }

  /**
   * Compress old key events into a summary when count exceeds threshold.
   * Keeps the most recent events intact and merges older ones via AI summarization.
   * Runs in the background after extractMemoryFromTurn when needed.
   */
  async function compressMemories(characterId: string): Promise<void> {
    const memory = getMemory(characterId)
    if (memory.keyEvents.length < COMPRESSION_THRESHOLD)
      return

    const eventsToCompress = memory.keyEvents.slice(0, -COMPRESSION_KEEP_RECENT)
    if (eventsToCompress.length < 5)
      return

    const eventSummaries = eventsToCompress.map(e => `- ${e.summary}`).join('\n')
    const prompt = `You are a memory compression system. Below are ${eventsToCompress.length} memory entries from a character's interaction history. Compress them into ${Math.min(5, Math.ceil(eventsToCompress.length / 5))} concise summary entries that preserve the most important facts, relationships, and emotional milestones. Drop routine/trivial entries.

## Entries to compress
${eventSummaries}

## Task
Return a JSON array of strings, each being a compressed summary entry. Return ONLY the JSON array, no markdown fencing.`

    try {
      const compressed = await runAiJsonExtraction<string[]>(
        { prompt, maxTokens: 500, temperature: 0.2 },
        (raw) => {
          if (Array.isArray(raw))
            return raw.filter((s): s is string => typeof s === 'string')
          return []
        },
        1,
      )

      if (compressed && compressed.length > 0) {
        const compressedEvents: MemoryKeyEvent[] = compressed.map(s => ({
          summary: s,
          timestamp: eventsToCompress[0].timestamp,
        }))

        const recentEvents = memory.keyEvents.slice(-COMPRESSION_KEEP_RECENT)
        memory.keyEvents = [...compressedEvents, ...recentEvents]

        // Also compress userProfile: merge duplicates
        const profileMap = new Map<string, string>()
        for (const entry of memory.userProfile)
          profileMap.set(entry.key, entry.value)
        memory.userProfile = Array.from(profileMap.entries()).map(([key, value]) => ({ key, value }))
      }
    }
    catch (err) {
      console.warn(`[MemoryStore] compression failed for ${characterId}:`, err)
    }
  }

  function clearMemory(characterId: string) {
    memories.value.set(characterId, {
      characterId,
      keyEvents: [],
      userProfile: [],
      emotionalState: createDefaultEmotionalState(),
      emotionalHistory: [],
    })
  }

  return {
    memories,
    getMemory,
    formatMemoryForPrompt,
    extractMemoryFromTurn,
    compressMemories,
    clearMemory,
    init,
    flush,
    $reset,
  }
})
