<template>
  <div class="col-span-1 flex flex-col justify-end items-center animate animate-fade-in-left">
    <img
      class="tachie-character inline-block transform"
      :class="characterClass"
      :style="character.style"
      :src="statusSrc"
      :alt="character.name"
    >
  </div>
</template>

<script setup lang="ts">
import type { CharacterInfo } from '~/data/characters'
import { adv } from '~/setup/adv'
const props = defineProps<{ character: CharacterInfo }>()

const advStore = adv.store

const active = computed(() => {
  const curDialog = advStore.cur.dialog.value
  return curDialog.character && (curDialog.character.name === props.character.name)
})

const statusSrc = computed(() => {
  let src = ''
  const curDialog = advStore.cur.dialog.value
  if (curDialog.character) {
    const status = curDialog.character.status
    src = props.character.tachies[status]
  }
  return src || props.character.tachies[props.character.initStatus]
})

const characterClass = computed(() => {
  const defaultClass: string[] = []
  let resultClass: string[] = []
  if (props.character) {
    if (props.character.class)
      resultClass = defaultClass.concat(props.character.class)

    if (!active.value)
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
