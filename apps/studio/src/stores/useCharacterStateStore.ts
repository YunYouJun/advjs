import type { AdvCharacterDynamicState } from '@advjs/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import { runAiJsonExtraction, shouldSkipExtraction } from '../utils/aiExtraction'
import { db } from '../utils/db'
import { getOrCreateInMap, loadMapFromDexie, useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'
import { PromptBuilder } from '../utils/promptBuilder'
import { useCharacterMemoryStore } from './useCharacterMemoryStore'

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
- "recentEvent": string | null — A brief note of a notable event or action in this exchange (null if nothing noteworthy)

Return ONLY the JSON object, no markdown fencing or explanation.`
}

export const useCharacterStateStore = defineStore('characterState', () => {
  const states = ref<Map<string, AdvCharacterDynamicState>>(new Map())

  // --- Dexie persistence ---

  const { flush, init, $reset } = useProjectPersistence({
    source: states,
    save: async () => {
      const pid = getCurrentProjectId()
      const entries = Array.from(states.value.entries())
      const rows = entries.map(([characterId, state]) => ({
        projectId: pid,
        characterId,
        state,
      }))
      await db.characterStates.bulkPut(rows)
    },
    load: async (pid) => {
      const map = await loadMapFromDexie<AdvCharacterDynamicState>(
        db.characterStates,
        pid,
        row => row.characterId,
        row => row.state,
      )
      if (map)
        states.value = map
    },
    clear: () => {
      states.value = new Map()
    },
  })

  function getState(characterId: string): AdvCharacterDynamicState {
    return getOrCreateInMap(states.value, characterId, () => createDefaultState())
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

    const builder = new PromptBuilder()
      .line(i18n.global.t('systemPrompt.state.header'))
      .line()

    if (mood && mood !== 'neutral')
      builder.line(i18n.global.t('systemPrompt.state.mood', { mood }))
    if (state.location)
      builder.line(i18n.global.t('systemPrompt.state.location', { location: state.location }))
    if (state.health)
      builder.line(i18n.global.t('systemPrompt.state.health', { health: state.health }))
    if (state.activity)
      builder.line(i18n.global.t('systemPrompt.state.activity', { activity: state.activity }))

    if (state.recentEvents && state.recentEvents.length > 0) {
      builder
        .line()
        .line(i18n.global.t('systemPrompt.state.recentEventsHeader'))
        .items(state.recentEvents.slice(-5).map(event => `- ${event}`))
    }

    builder.line()
    return builder.build()
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
    if (shouldSkipExtraction(assistantMessage))
      return

    const state = getState(characterId)
    const prompt = buildStateExtractionPrompt(characterName, userMessage, assistantMessage, state)

    try {
      const extraction = await runAiJsonExtraction(
        { prompt, maxTokens: 200, temperature: 0.3 },
        parsed => ({
          location: typeof parsed.location === 'string' ? parsed.location : null,
          health: typeof parsed.health === 'string' ? parsed.health : null,
          activity: typeof parsed.activity === 'string' ? parsed.activity : null,
          recentEvent: typeof parsed.recentEvent === 'string' ? parsed.recentEvent : null,
        }),
      )
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
      if (extraction.recentEvent !== null) {
        const current = getState(characterId)
        const existing = current.recentEvents || []
        updates.recentEvents = [...existing, extraction.recentEvent].slice(-10)
      }

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
    init,
    flush,
    $reset,
  }
})
