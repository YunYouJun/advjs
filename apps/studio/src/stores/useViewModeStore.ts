import type { AdvCharacter } from '@advjs/types'
import { exportCharacterForAI } from '@advjs/parser'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import i18n from '../i18n'
import { db } from '../utils/db'
import { useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'

export type ViewMode = 'character' | 'god' | 'visitor'

const MODE_STORAGE_KEY = 'advjs-studio-view-mode'

/**
 * Load the global `mode` preference from localStorage.
 * Project-level data (playerCharacterId, customCharacters) is now in Dexie.
 */
function loadModeFromStorage(): ViewMode {
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      return data.mode || 'visitor'
    }
  }
  catch {
    // ignore
  }
  return 'visitor'
}

function saveModeToStorage(mode: ViewMode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify({ mode }))
  }
  catch {
    // ignore
  }
}

export const useViewModeStore = defineStore('viewMode', () => {
  // --- Global preference (localStorage) ---
  const mode = ref<ViewMode>(loadModeFromStorage())

  // --- Project-scoped data (Dexie) ---
  const playerCharacterId = ref<string | null>(null)
  const customCharacters = ref<AdvCharacter[]>([])

  const playerCharacter = computed<AdvCharacter | null>(() => {
    if (!playerCharacterId.value)
      return null
    return customCharacters.value.find(c => c.id === playerCharacterId.value) || null
  })

  // --- Dexie persistence ---

  const { flush, init, $reset } = useProjectPersistence({
    source: [playerCharacterId, customCharacters],
    save: async () => {
      const pid = getCurrentProjectId()
      await db.viewModes.put({
        projectId: pid,
        playerCharacterId: playerCharacterId.value,
        customCharacters: customCharacters.value,
      })
    },
    load: async (pid) => {
      const row = await db.viewModes.get(pid)
      if (row) {
        playerCharacterId.value = row.playerCharacterId
        customCharacters.value = row.customCharacters || []
      }
    },
    clear: () => {
      playerCharacterId.value = null
      customCharacters.value = []
    },
  })

  // --- Actions ---

  function setMode(m: ViewMode) {
    mode.value = m
    saveModeToStorage(m)
  }

  function setPlayerCharacter(id: string) {
    playerCharacterId.value = id
  }

  function clearPlayerCharacter() {
    playerCharacterId.value = null
  }

  function addCustomCharacter(char: AdvCharacter) {
    customCharacters.value.push(char)
  }

  function updateCustomCharacter(char: AdvCharacter) {
    const index = customCharacters.value.findIndex(c => c.id === char.id)
    if (index !== -1)
      customCharacters.value[index] = char
  }

  function removeCustomCharacter(id: string) {
    customCharacters.value = customCharacters.value.filter(c => c.id !== id)
    if (playerCharacterId.value === id)
      playerCharacterId.value = null
  }

  function getSystemPromptPrefix(playerChar?: AdvCharacter | null): string {
    const pc = playerChar ?? playerCharacter.value

    switch (mode.value) {
      case 'character': {
        if (!pc)
          return ''
        const personalitySummary = pc.personality
          ? pc.personality.slice(0, 100)
          : ''
        const charInfo = exportCharacterForAI(pc)
        return i18n.global.t('systemPrompt.viewMode.characterPrefix', {
          name: pc.name,
          personality: personalitySummary ? `${personalitySummary}。` : '',
          charInfo,
        })
      }
      case 'god':
        return i18n.global.t('systemPrompt.viewMode.godPrefix')
      case 'visitor':
      default:
        return ''
    }
  }

  /**
   * Prepend the view-mode system prompt prefix to a world context string.
   * Use this instead of manually calling getSystemPromptPrefix() in each page.
   */
  function getEffectiveWorldContext(worldContext: string): string {
    const prefix = getSystemPromptPrefix()
    return prefix ? `${prefix}\n\n${worldContext}` : worldContext
  }

  return {
    mode,
    playerCharacterId,
    customCharacters,
    playerCharacter,
    setMode,
    setPlayerCharacter,
    clearPlayerCharacter,
    addCustomCharacter,
    updateCustomCharacter,
    removeCustomCharacter,
    getSystemPromptPrefix,
    getEffectiveWorldContext,
    init,
    flush,
    $reset,
  }
})
