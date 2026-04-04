import type { AdvCharacter, WorldClockState, WorldEvent } from '@advjs/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import { runAiJsonExtraction } from '../utils/aiExtraction'
import { db } from '../utils/db'
import { useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'
import { useAiSettingsStore } from './useAiSettingsStore'

const MAX_EVENTS = 200

function generateId(): string {
  return `evt-${crypto.randomUUID()}`
}

export const useWorldEventStore = defineStore('worldEvent', () => {
  const events = ref<WorldEvent[]>([])
  const isGenerating = ref(false)

  // --- Dexie persistence ---

  const { flush, init, $reset: _$reset } = useProjectPersistence({
    source: events,
    save: async () => {
      const pid = getCurrentProjectId()
      const rows = events.value.map(e => ({ ...e, projectId: pid }))
      await db.worldEvents.bulkPut(rows)
    },
    load: async (pid) => {
      const all = await db.worldEvents.where('projectId').equals(pid).toArray()
      if (all.length > 0) {
        events.value = all
      }
    },
    clear: () => {
      events.value = []
      isGenerating.value = false
    },
  })

  // Alias to preserve the original $reset name
  const $reset = _$reset

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
    return `${i18n.global.t('systemPrompt.events.header')}\n\n${lines.join('\n')}`
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
      "summary": "Brief description of the event",
      "type": "daily" | "social" | "unexpected",
      "characterIds": ["character_id"] or []
    }
  ],
  "weather": ${dateChanged ? '"new weather description"' : 'null'}
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

    try {
      const parsed = await runAiJsonExtraction(
        { prompt, maxTokens: 300, temperature: 0.7 },
        raw => ({
          events: Array.isArray(raw.events) ? raw.events : [],
          weather: typeof raw.weather === 'string' && raw.weather ? raw.weather : null,
        }),
      )
      if (!parsed)
        return

      // Add generated events
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

      // Return weather for the clock store to apply
      if (parsed.weather) {
        // Add a weather event
        addEvent({
          id: generateId(),
          date: clockState.date,
          period: clockState.period,
          summary: i18n.global.t('systemPrompt.events.weatherChanged', { weather: parsed.weather }),
          type: 'weather',
          timestamp: Date.now(),
        })
        return parsed.weather
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
    init,
    flush,
    $reset,
  }
})
