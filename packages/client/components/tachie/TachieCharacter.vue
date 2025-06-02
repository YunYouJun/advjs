<script setup lang="ts">
import type { TachieState } from '@advjs/client'
import { useAdvContext } from '@advjs/client'
import { computed } from 'vue'

const props = defineProps<{
  tachie: TachieState
  characterId: string
}>()

const { $adv } = useAdvContext()

const advStore = $adv.store

const active = computed(() => {
  const curDialog = advStore.cur.dialog
  if (curDialog.type === 'dialog') {
    const character = $adv.gameConfig?.value?.characters?.find(item => item.id === props.characterId)
    if (!character)
      return false
    if (curDialog.character && [character.id, character.alias].includes(curDialog.character.name))
      return true
  }
  return false
})

const curTachie = computed(() => {
  return $adv.runtime.charactersMap.get(props.characterId)?.tachies?.[props.tachie.status]
})

const characterClass = computed(() => {
  const defaultClass: string[] = []
  let resultClass: string[] = []
  if (curTachie.value?.class)
    resultClass = defaultClass.concat(curTachie.value?.class || [])

  if (active.value)
    resultClass.push('active')
  return resultClass
})
</script>

<template>
  <Transition appear>
    <div class="col-span-1 h-full flex flex-col items-center justify-end overflow-hidden">
      <img
        class="tachie-character inline-flex transform"
        :class="characterClass"
        :style="curTachie?.style"
        :src="curTachie?.src"
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
