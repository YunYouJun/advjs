<template>
  <div class="tachie-box grid grid-cols-2 absolute pointer-events-none" w="full" h="full">
    <TachieCharacter
      v-for="(character, i) in props.characters"
      :key="i"
      :character="character"
    />
  </div>
</template>

<script setup lang="ts">
import type { CharacterInfo } from '~/data/characters'
const props = defineProps<{
  characters: CharacterInfo[]
}>()
</script>

<style lang="scss">
.tachie-box {
  overflow: hidden;
}
</style>
