<script setup lang="ts">
import type { Tachie } from '@advjs/types'
import { computed, watch } from 'vue'
import { useAdvCtx, useAppStore } from '@advjs/client'

const props = defineProps<{
  tachies: Map<string, Tachie>
}>()

const app = useAppStore()

const $adv = useAdvCtx()

/**
 * watch to update tachie
 */
watch(() => $adv.store.curNode, () => {
  const curNode = $adv.store.curNode
  if (curNode && curNode.type === 'dialog') {
    if (curNode.character.status !== '') {
      // update tachies
      $adv.tachies.update(curNode)
    }
  }
})

const classes = computed(() => {
  const arr = []
  if (props.tachies.size)
    arr.push(`grid-cols-${props.tachies.size}`)
  return arr
})
</script>

<template>
  <Transition enter-active-class="animate__fadeInLeft" leave-active-class="animate__fadeOutLeft">
    <div v-if="app.showTachie" grid="~" :class="classes" class="tachie-box absolute pointer-events-none adv-animated" w="full" h="full">
      <TachieCharacter
        v-for="tachie in props.tachies" :key="tachie[0]"
        :character="tachie[0]"
        :tachie="tachie[1]"
      />
    </div>
  </Transition>
</template>

<style lang="scss">
.tachie-box {
  overflow: hidden;
}
</style>
