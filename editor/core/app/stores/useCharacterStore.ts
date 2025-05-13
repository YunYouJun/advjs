import type { AdvCharacter } from '@advjs/types'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useCharacterStore = defineStore('editor:character', () => {
  /**
   * 被选择的角色
   */
  const selectedCharacter = ref<AdvCharacter>()

  return {
    selectedCharacter,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useCharacterStore, import.meta.hot))
