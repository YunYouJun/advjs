<script setup lang="ts">
import { useAdvContext } from '@advjs/client'

const { $adv } = useAdvContext()

const characters = computed(() => {
  return $adv.gameConfig.value.characters
})
</script>

<template>
  <div class="grid grid-cols-4 gap-2 p-2">
    <AECharacterCard v-for="character in characters" :key="character.id" :character="character" />
  </div>
</template>
