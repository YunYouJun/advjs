<script setup lang="ts">
import type { Tachie } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import { computed } from 'vue'

const props = defineProps<{
  tachie: Tachie
  character: string
}>()

const { $adv } = useAdvContext()

const advStore = $adv.store

const active = computed(() => {
  const curDialog = advStore.cur.dialog
  if (curDialog.type === 'dialog') {
    return curDialog.character && (curDialog.character.name === props.character)
  }
  return false
})

const characterClass = computed(() => {
  const defaultClass: string[] = []
  let resultClass: string[] = []
  if (props.tachie.class)
    resultClass = defaultClass.concat(props.tachie.class)

  if (active.value)
    resultClass.push('active')
  return resultClass
})
</script>

<template>
  <Transition appear>
    <div class="col-span-1 flex flex-col items-center justify-end">
      <img
        class="tachie-character inline-block transform"
        :class="characterClass"
        :style="tachie.style"
        :src="tachie.src"
      >
    </div>
  </Transition>
</template>

<style lang="scss">
.tachie-character {
  max-width: calc(0.4 * var(--adv-screen-width));

  filter: brightness(50%);
  transition: var(--adv-animation-duration-fast) all linear;

  &.active {
    filter: brightness(100%);
  }
}
</style>
