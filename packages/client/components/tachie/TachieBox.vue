<script setup lang="ts">
import type { Tachie } from '@advjs/types'
import { watch } from 'vue'
import { useAppStore } from '~/stores/app'
import { useAdvCtx } from '~/setup'

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
      $adv.core.updateTachie(curNode)
    }
  }
})
</script>

<template>
  <transition enter-active-class="animate__fadeInLeft" leave-active-class="animate__fadeOutLeft">
    <div v-if="app.showTachie" grid="~ cols-2" class="tachie-box absolute pointer-events-none animate__animated" w="full" h="full">
      <TachieCharacter
        v-for="value in props.tachies" :key="value[0]"
        :character="value[0]"
        :tachie="value[1]"
      />
    </div>
  </transition>
</template>

<style lang="scss">
.tachie-box {
  overflow: hidden;
}
</style>
