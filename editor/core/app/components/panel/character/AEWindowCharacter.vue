<script setup lang="ts">
import { useAdvContext } from '@advjs/client'

const { $adv } = useAdvContext()
const characterStore = useCharacterStore()

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
  <div class="grid grid-cols-4 gap-2 p-2">
    <AECharacterCard v-for="character in allCharacters" :key="character.id" :character="character" />

    <!-- Empty state -->
    <div v-if="!allCharacters.length" class="col-span-4 flex flex-col items-center justify-center gap-2 p-4 op-50">
      <div class="i-ri-user-3-line text-2xl" />
      <span class="text-xs">{{ $t('characters.noCharacters') }}</span>
    </div>
  </div>
</template>
