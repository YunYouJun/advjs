import type { AdvCharacter } from '@advjs/types'
import { exportCharacterForAI } from '@advjs/parser'
import { computed, ref, watch } from 'vue'

export type ViewMode = 'character' | 'god' | 'visitor'

const STORAGE_KEY = 'advjs-studio-view-mode'

interface ViewModeStorageData {
  mode: ViewMode
  playerCharacterId: string | null
  customCharacters: AdvCharacter[]
}

function loadFromStorage(): ViewModeStorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as ViewModeStorageData
      return {
        mode: data.mode || 'visitor',
        playerCharacterId: data.playerCharacterId || null,
        customCharacters: data.customCharacters || [],
      }
    }
  }
  catch {
    // ignore
  }
  return { mode: 'visitor', playerCharacterId: null, customCharacters: [] }
}

function saveToStorage(data: ViewModeStorageData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
  catch {
    // ignore
  }
}

const stored = loadFromStorage()

const mode = ref<ViewMode>(stored.mode)
const playerCharacterId = ref<string | null>(stored.playerCharacterId)
const customCharacters = ref<AdvCharacter[]>(stored.customCharacters)

// Persist on change
watch([mode, playerCharacterId, customCharacters], () => {
  saveToStorage({
    mode: mode.value,
    playerCharacterId: playerCharacterId.value,
    customCharacters: customCharacters.value,
  })
}, { deep: true })

const playerCharacter = computed<AdvCharacter | null>(() => {
  if (!playerCharacterId.value)
    return null
  return customCharacters.value.find(c => c.id === playerCharacterId.value) || null
})

export function useViewModeStore() {
  function setMode(m: ViewMode) {
    mode.value = m
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
        return `用户正在扮演「${pc.name}」，是这个世界中的一个角色。${personalitySummary ? `${personalitySummary}。` : ''}请把他们当作在场的角色对待，用名字称呼他们，自然地对他们的存在做出反应。以下是关于「${pc.name}」的信息：\n${charInfo}`
      }
      case 'god':
        return '用户是全知全能的叙述者/创造者，存在于故事世界之外。他们可以观察一切、了解所有角色的想法、引导事件走向。请像对待你的创造者一样回应——可以分享内心想法、打破第四面墙、接受叙事指令。'
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
  }
}
