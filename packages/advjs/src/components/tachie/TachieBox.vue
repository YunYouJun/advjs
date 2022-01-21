<template>
  <transition enter-active-class="animate-fadeInLeft" leave-active-class="animate-fadeOutLeft">
    <div v-if="app.showTachie" grid="~ cols-2" class="tachie-box absolute pointer-events-none animate-animated" w="full" h="full">
      <TachieCharacter
        v-for="(character, i) in props.characters"
        :key="i"
        :character="character"
      />
    </div>
  </transition>
</template>

<script setup lang="ts">
import type { CharacterInfo } from '~/data/characters'
import { useAppStore } from '~/stores/app'
const props = defineProps<{
  characters: CharacterInfo[]
}>()

const app = useAppStore()
</script>

<style lang="scss">
.tachie-box {
  overflow: hidden;
}
</style>
