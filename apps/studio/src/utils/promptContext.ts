/**
 * Character prompt context gathering utilities.
 *
 * Extracts common "collect memory + state + clock + events" pattern
 * shared by useCharacterChatStore and useGroupChatStore.
 */

import { useCharacterMemoryStore } from '../stores/useCharacterMemoryStore'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
import { useWorldClockStore } from '../stores/useWorldClockStore'
import { useWorldEventStore } from '../stores/useWorldEventStore'

export interface CharacterPrompts {
  memoryPrompt: string
  statePrompt: string
  clockPrompt: string
  eventsPrompt: string
}

/**
 * Gather all context prompts (memory, state, clock, events) for a character.
 * Must be called inside a Pinia-enabled context (store action or setup).
 */
export function gatherCharacterPrompts(characterId: string): CharacterPrompts {
  const memoryStore = useCharacterMemoryStore()
  const stateStore = useCharacterStateStore()
  const clockStore = useWorldClockStore()
  const eventStore = useWorldEventStore()

  return {
    memoryPrompt: memoryStore.formatMemoryForPrompt(characterId),
    statePrompt: stateStore.formatStateForPrompt(characterId),
    clockPrompt: clockStore.formatClockForPrompt(),
    eventsPrompt: eventStore.formatEventsForPrompt(),
  }
}
