<script setup lang="ts">
import type { Tachie } from '@advjs/types'
import { useAppStore } from '~/stores/app'

const props = defineProps<{
  tachies: Map<string, Tachie>
}>()

const app = useAppStore()
</script>

<template>
  <transition enter-active-class="animate-fadeInLeft" leave-active-class="animate-fadeOutLeft">
    <div v-if="app.showTachie" grid="~ cols-2" class="tachie-box absolute pointer-events-none animate-animated" w="full" h="full">
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
