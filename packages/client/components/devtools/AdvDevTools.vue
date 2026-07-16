<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useAdvContext } from '../../composables'
import {
  createRuntimeDebugReport,
  projectRuntimeInspector,
} from '../../runtime'
import RuntimeInspectorPanel from './RuntimeInspectorPanel.vue'

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

const inspector = computed(() => projectRuntimeInspector(
  $adv.runtime.snapshot(),
  $adv.store.current,
  $adv.runtime.trace(),
))

function exportReport() {
  const report = createRuntimeDebugReport({
    snapshot: $adv.runtime.snapshot(),
    trace: $adv.runtime.trace(),
  })
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'advjs-runtime-report.json'
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <button
    ref="buttonRef"
    type="button"
    aria-label="Open runtime inspector"
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
    class="text-white p-4 bg-dark max-w-3xl min-w-md bottom-0 right-0 top-0 fixed z-9999 overflow-auto"
    aria-label="Runtime inspector"
  >
    <RuntimeInspectorPanel :model="inspector" @export="exportReport" />
  </aside>
</template>
