import type { WorldEvent } from '@advjs/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import { db } from '../utils/db'
import { useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'

const MAX_EVENTS = 200

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

  /** Managed world-event generation is not registered yet and fails closed. */
  async function generateEvents(
    _worldContext: string,
    _characters: unknown[],
    _clockState: unknown,
    _dateChanged: boolean,
  ): Promise<string | undefined> {
    return undefined
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
