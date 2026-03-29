import type { AdvCharacter, WorldClockState, WorldEvent } from '@advjs/types'
import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { buildStreamOptions, streamChat } from '../utils/aiClient'
import { CODE_FENCE_END_RE, CODE_FENCE_START_RE } from '../utils/chatUtils'
import { useAiSettingsStore } from './useAiSettingsStore'

const STORAGE_KEY = 'advjs-studio-world-events'
const MAX_EVENTS = 200

let nextId = 1

function generateId(): string {
  return `evt-${Date.now()}-${nextId++}`
}

export const useWorldEventStore = defineStore('worldEvent', () => {
  const events = ref<WorldEvent[]>([])
  const isGenerating = ref(false)

  // Load from localStorage on init
  loadFromStorage()

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: WorldEvent[] = JSON.parse(saved)
        events.value = parsed
      }
    }
    catch {
      // ignore
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events.value))
    }
    catch {
      // ignore
    }
  }

  // Persist on change
  watch(events, () => {
    saveToStorage()
  }, { deep: true })

  function addEvent(event: WorldEvent) {
    events.value.push(event)
    // Trim to max
    if (events.value.length > MAX_EVENTS) {
      events.value = events.value.slice(-MAX_EVENTS)
    }
  }

  function getRecentEvents(n: number): WorldEvent[] {
    return events.value.slice(-n)
  }

  /**
   * Format recent events for system prompt injection.
   */
  function formatEventsForPrompt(): string {
    const recent = getRecentEvents(5)
    if (recent.length === 0)
      return ''

    const lines = recent.map(e => `- [${e.date} ${e.period}] ${e.summary}`)
    return `# 最近世界事件\n\n${lines.join('\n')}`
  }

  /**
   * Get events related to a specific character.
   */
  function getCharacterEvents(characterId: string, n: number = 5): WorldEvent[] {
    return events.value
      .filter(e => e.characterIds?.includes(characterId))
      .slice(-n)
  }

  /**
   * Build the prompt for AI event generation.
   */
  function buildEventGenerationPrompt(
    worldContext: string,
    characters: AdvCharacter[],
    clockState: WorldClockState,
    dateChanged: boolean,
  ): string {
    const charSummary = characters.map(c => `- ${c.name} (${c.id})`).join('\n')

    return `You are a world event generator for a visual novel / life simulation.

## World Background
${worldContext || '(no world context)'}

## Characters
${charSummary}

## Current Time
Date: ${clockState.date}
Period: ${clockState.period}
Weather: ${clockState.weather || '(unknown)'}

## Task
Generate 1-2 small events that naturally happen in this world right now.
${dateChanged ? 'Also suggest new weather for today since the date changed.' : 'Do not change the weather.'}

Return ONLY a JSON object:
{
  "events": [
    {
      "summary": "Brief description of the event in Chinese",
      "type": "daily" | "social" | "unexpected",
      "characterIds": ["character_id"] or []
    }
  ],
  "weather": ${dateChanged ? '"new weather description in Chinese"' : 'null'}
}

Return ONLY the JSON, no markdown fencing or explanation.`
  }

  /**
   * Generate random events and optionally weather via AI.
   */
  async function generateEvents(
    worldContext: string,
    characters: AdvCharacter[],
    clockState: WorldClockState,
    dateChanged: boolean,
  ): Promise<string | undefined> {
    const aiSettings = useAiSettingsStore()
    if (!aiSettings.isConfigured || isGenerating.value)
      return

    isGenerating.value = true

    const prompt = buildEventGenerationPrompt(worldContext, characters, clockState, dateChanged)
    const messages: AiChatMessage[] = [
      { role: 'system', content: 'You are a JSON event generator. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ]

    try {
      const options = buildStreamOptions(
        messages,
        aiSettings.config,
        aiSettings.effectiveBaseURL,
        aiSettings.effectiveModel,
      )
      options.maxTokens = 300
      options.temperature = 0.7

      let accumulated = ''
      for await (const delta of streamChat(options)) {
        accumulated += delta
      }

      const cleaned = accumulated.replace(CODE_FENCE_START_RE, '').replace(CODE_FENCE_END_RE, '').trim()
      const parsed = JSON.parse(cleaned)

      // Add generated events
      if (Array.isArray(parsed.events)) {
        for (const evt of parsed.events) {
          if (typeof evt.summary === 'string') {
            addEvent({
              id: generateId(),
              date: clockState.date,
              period: clockState.period,
              summary: evt.summary,
              type: evt.type || 'daily',
              characterIds: Array.isArray(evt.characterIds) ? evt.characterIds : undefined,
              timestamp: Date.now(),
            })
          }
        }
      }

      // Return weather for the clock store to apply
      if (typeof parsed.weather === 'string' && parsed.weather) {
        // Add a weather event
        addEvent({
          id: generateId(),
          date: clockState.date,
          period: clockState.period,
          summary: `天气变为${parsed.weather}`,
          type: 'weather',
          timestamp: Date.now(),
        })
        return parsed.weather as string
      }
    }
    catch {
      // Event generation is best-effort
    }
    finally {
      isGenerating.value = false
    }
  }

  function clearEvents() {
    events.value = []
  }

  return {
    events,
    isGenerating,
    addEvent,
    getRecentEvents,
    getCharacterEvents,
    formatEventsForPrompt,
    generateEvents,
    clearEvents,
  }
})
