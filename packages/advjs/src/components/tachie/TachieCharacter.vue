<template>
  <div class="col-span-1 flex flex-col justify-end items-center">
    <img
      :class="characterClass"
      :style="character.style"
      :src="character.tachies[character.status]"
      :alt="character.name"
    />
  </div>
</template>

<script setup lang="ts">
import type { Character } from '~/data/characters'
const props = defineProps<{character: Character}>()

const characterClass = computed(() => {
  const defaultClass = ['tachie-character', 'inline-block', 'transform']
  let resultClass = defaultClass
  if (props.character) {
    if (props.character.class)
      resultClass = defaultClass.concat(props.character.class)

    if (!props.character.active)
      resultClass.push('inactive-character')
  }
  return resultClass
})
</script>

<style lang="scss">
.tachie-character {
  max-width: 40%;
}

.inactive-character {
  filter: brightness(50%);
}
</style>
