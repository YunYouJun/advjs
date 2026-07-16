<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useAdvContext } from '../../composables'

const buttonRef = useTemplateRef<HTMLElement>('buttonRef')
const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth
const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight
const { style } = useDraggable(buttonRef, {
  initialValue: {
    x: viewportWidth - 80,
    y: viewportHeight - 80,
  },
})
const showDevTools = shallowRef(false)
const { $adv } = useAdvContext()

const inspector = computed(() => ({
  address: $adv.store.state.cursor,
  status: $adv.store.state.status,
  current: $adv.store.current,
  variables: $adv.store.state.variables,
  stage: $adv.store.state.stage,
  choices: $adv.store.state.choices,
  visited: $adv.store.state.visited,
  checkpoints: $adv.runtime.snapshot().checkpoints.length,
}))
</script>

<template>
  <button
    ref="buttonRef"
    class="rounded-full bg-dark flex size-12 shadow items-center bottom-6 right-6 justify-center fixed z-9999"
    :style="style"
    @click="showDevTools = !showDevTools"
  >
    ⚔️
  </button>

  <div
    v-if="showDevTools"
    class="bg-black/50 bottom-0 left-0 right-0 top-0 fixed z-9998"
    @click="showDevTools = false"
  />

  <aside
    v-if="showDevTools"
    class="text-white p-4 bg-dark max-w-2xl min-w-md bottom-0 right-0 top-0 fixed z-9999 overflow-auto"
  >
    <h2 class="text-xl font-bold mb-4">
      Runtime Inspector
    </h2>
    <pre class="text-left whitespace-pre-wrap">{{ inspector }}</pre>
  </aside>
</template>
