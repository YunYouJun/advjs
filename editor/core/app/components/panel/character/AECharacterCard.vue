<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'

const props = defineProps<{
  character: AdvCharacter
}>()

const app = useAppStore()
const cStore = useCharacterStore()

function onClickCharacter() {
  app.activeInspector = 'character'
  cStore.selectedCharacter = props.character
}
</script>

<template>
  <div
    :key="character.id"
    class="relative inline-flex flex-grow flex-col cursor-pointer gap-2 rounded bg-dark-500 p-2 shadow"
    @click="onClickCharacter"
  >
    <div class="rounded text-center">
      {{ character.id }}
    </div>

    <div class="text-center font-bold">
      {{ character.name }}
    </div>

    <!-- <img v-if="character.avatar" :src="character.avatar" /> -->

    <div class="tachies flex flex-wrap justify-center">
      <div
        v-for="(tachie, tachieKey) in character.tachies" :key="tachieKey"
        class="tachie flex flex-col gap-1"
      >
        <img v-if="tachie" class="size-10 object-contain" :src="tachie.src">
        <div class="text-xs op-80">
          {{ tachieKey }}
        </div>
      </div>
    </div>
  </div>
</template>
