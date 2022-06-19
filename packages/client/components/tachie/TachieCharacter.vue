<script setup lang="ts">
import type { Tachie } from '@advjs/types'
import { computed } from 'vue'
import { useAdvCtx } from '~/setup/adv'

const props = defineProps<{ tachie: Tachie;character: string }>()

const $adv = useAdvCtx()

const advStore = $adv.store

const active = computed(() => {
  const curDialog = advStore.cur.dialog
  return curDialog.character && (curDialog.character.name === props.character)
})

const characterClass = computed(() => {
  const defaultClass: string[] = []
  let resultClass: string[] = []
  if (props.tachie.class)
    resultClass = defaultClass.concat(props.tachie.class)

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
      :style="tachie.style"
      :src="tachie.src"
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
