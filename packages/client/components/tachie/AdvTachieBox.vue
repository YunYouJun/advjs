<script setup lang="ts">
import type { TachieState } from '@advjs/client'
import { useAdvContext, useAppStore } from '@advjs/client'
import { computed, watch } from 'vue'

const props = defineProps<{
  tachiesMap: Map<string, TachieState>
}>()

const app = useAppStore()
const { $adv } = useAdvContext()

/**
 * watch to update tachie
 */
watch(() => $adv.store.curNode, () => {
  const curNode = $adv.store.curNode
  if (curNode && curNode.type === 'dialog') {
    if (curNode.character.status !== '') {
      // update tachies
      $adv.$tachies.update(curNode)
    }
  }
})

const classes = computed(() => {
  const arr = []
  if (props.tachiesMap.size)
    arr.push(`grid-cols-${props.tachiesMap.size}`)
  return arr
})
</script>

<template>
  <Transition enter-active-class="animate-fade-in-left" leave-active-class="animate-fade-out-left">
    <div
      v-if="app.showTachie" grid="~"
      :class="classes"
      class="adv-tachie-box pointer-events-none absolute size-full animate-duration-200 overflow-hidden"
    >
      <TachieCharacter
        v-for="tachie in props.tachiesMap" :key="tachie[0]"
        :character-id="tachie[0]"
        :tachie="tachie[1]"
      />
    </div>
  </Transition>
</template>
