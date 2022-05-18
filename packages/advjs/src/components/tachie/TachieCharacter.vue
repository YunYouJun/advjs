<script setup lang="ts">
import type { TachieState } from '@advjs/core'
import { adv } from '~/setup/adv'

const props = defineProps<{ character: TachieState }>()

const advStore = adv.store

const active = computed(() => {
  const curDialog = advStore.cur.value.dialog
  return curDialog.character && (curDialog.character.name === props.character.name)
})

const characterClass = computed(() => {
  const defaultClass: string[] = []
  let resultClass: string[] = []
  if (props.character.class)
    resultClass = defaultClass.concat(props.character.class)

  if (!active.value)
    resultClass.push('inactive-character')
  return resultClass
})
</script>

<template>
  <div class="col-span-1 flex flex-col justify-end items-center ">
    <img
      class="tachie-character inline-block transform"
      :class="characterClass"
      :style="character.style"
      :src="character.src"
      :alt="character.name"
    >
  </div>
</template>

<style lang="scss">
.tachie-character {
  max-width: 40%;
}

.inactive-character {
  filter: brightness(50%);
}
</style>
