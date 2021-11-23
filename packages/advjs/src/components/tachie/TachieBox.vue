<template>
  <div class="tachie-box grid grid-cols-2">
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
  width: 100%;
  height: 100%;
  position: relative;

  overflow: hidden;
}
</style>
