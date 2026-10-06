<script setup lang="ts">
import { useAdvContext } from '@advjs/client'

const { $adv } = useAdvContext()
const characterStore = useCharacterStore()
const app = useAppStore()
function selectCharacter(character: typeof characterStore.characters[number]) {
  characterStore.selectedCharacter = character
  characterStore.selectedCharacterHandle = characterStore.fileEntries.get(character.id)?.fileHandle
  app.activeInspector = 'character'
}

const gameConfigCharacters = computed(() => {
  return $adv.gameConfig.value.characters || []
})

const dbCharacters = computed(() => {
  return characterStore.characters
})

// Merge: show DB characters + gameConfig characters not already in DB
const allCharacters = computed(() => {
  const dbIds = new Set(dbCharacters.value.map(c => c.id))
  const fromConfig = gameConfigCharacters.value.filter(c => !dbIds.has(c.id))
  return [...dbCharacters.value, ...fromConfig]
})
</script>

<template>
  <CharacterList :characters="allCharacters" :selected="characterStore.selectedCharacter?.id" @select="selectCharacter" />
</template>
