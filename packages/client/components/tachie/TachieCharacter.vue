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
  const node = advStore.current
  if (node?.kind === 'dialog') {
    const character = $adv.gameConfig?.value?.characters?.find(item => item.id === props.characterId)
    if (!character)
      return false
    const speaker = typeof node.data?.character === 'string' ? node.data.character : ''
    if (character.id === speaker || character.name === speaker || character.aliases?.includes(speaker))
      return true
  }
  return false
})

const curTachie = computed(() => {
  return $adv.resources.charactersMap.get(props.characterId)?.tachies?.[props.tachie.status]
})

const characterClass = computed(() => {
  const defaultClass: string[] = []
  let resultClass: string[] = []
  if (curTachie.value?.class)
    resultClass = [...defaultClass, ...curTachie.value?.class || []]

  if (active.value)
    resultClass.push('active')
  return resultClass
})
</script>

<template>
  <Transition appear>
    <div class="flex flex-col col-span-1 h-full items-center justify-end overflow-hidden">
      <Transition name="adv-tachie-status" mode="out-in">
        <img
          :key="curTachie?.src"
          class="tachie-character inline-flex transform"
          :class="characterClass"
          :style="curTachie?.style"
          :src="curTachie?.src"
        >
      </Transition>
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

.adv-tachie-status-enter-active,
.adv-tachie-status-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.adv-tachie-status-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.adv-tachie-status-leave-to {
  opacity: 0;
}
</style>
