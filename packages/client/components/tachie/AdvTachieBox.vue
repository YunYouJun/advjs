<script setup lang="ts">
import type { TachieState } from '@advjs/client'
import { useAdvContext, useAppStore } from '@advjs/client'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

interface RenderedTachie {
  state: TachieState
  leaving: boolean
  revision: number
}

const props = defineProps<{
  tachiesMap: Map<string, TachieState>
}>()

const app = useAppStore()
const { $adv } = useAdvContext()
const rendered = ref(new Map<string, RenderedTachie>())
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const cue = computed(() => $adv.resources.tachieCueRef.value)
let renderRevision = 0

function motionFor(name: string, kind: 'enter' | 'exit') {
  return cue.value?.value[kind].find(item => item.name === name)?.motion
}

function sync() {
  const instant = cue.value?.value.instant === true
  const next = new Map(rendered.value)
  for (const [name, state] of props.tachiesMap) {
    const timer = timers.get(name)
    if (timer)
      clearTimeout(timer)
    timers.delete(name)
    next.set(name, {
      state: { ...state, ...(motionFor(name, 'enter') ? { motion: motionFor(name, 'enter') } : {}) },
      leaving: false,
      revision: instant ? ++renderRevision : next.get(name)?.revision ?? ++renderRevision,
    })
  }
  for (const [name, item] of next) {
    if (props.tachiesMap.has(name) || item.leaving)
      continue
    if (instant) {
      next.delete(name)
      continue
    }
    next.set(name, {
      state: { ...item.state, motion: motionFor(name, 'exit') ?? 'fade' },
      leaving: true,
      revision: item.revision,
    })
    timers.set(name, setTimeout(() => {
      const current = new Map(rendered.value)
      current.delete(name)
      rendered.value = current
      timers.delete(name)
    }, 460))
  }
  rendered.value = next
}

watch([() => props.tachiesMap, cue], sync, { immediate: true, deep: false })
onBeforeUnmount(() => {
  for (const timer of timers.values())
    clearTimeout(timer)
})
</script>

<template>
  <div
    v-show="app.showTachie"
    class="adv-tachie-box size-full pointer-events-none absolute overflow-hidden"
  >
    <TachieCharacter
      v-for="[name, item] in rendered"
      :key="`${name}:${item.revision}`"
      :character-id="name"
      :tachie="item.state"
      :leaving="item.leaving"
      :instant="cue?.value.instant"
    />
  </div>
</template>

<style scoped>
.adv-tachie-box {
  inset: 0;
}
</style>
