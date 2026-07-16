<script setup lang="ts">
import type { TachieState } from '@advjs/client'
import { useAppStore } from '@advjs/client'
import { computed } from 'vue'

const props = defineProps<{
  tachiesMap: Map<string, TachieState>
}>()

const app = useAppStore()
const classes = computed(() => (
  props.tachiesMap.size ? [`grid-cols-${props.tachiesMap.size}`] : []
))
</script>

<template>
  <Transition enter-active-class="animate-fade-in-left" leave-active-class="animate-fade-out-left">
    <div
      v-if="app.showTachie"
      grid="~"
      :class="classes"
      class="adv-tachie-box size-full pointer-events-none absolute overflow-hidden animate-duration-200"
    >
      <TachieCharacter
        v-for="tachie in props.tachiesMap"
        :key="tachie[0]"
        :character-id="tachie[0]"
        :tachie="tachie[1]"
      />
    </div>
  </Transition>
</template>
