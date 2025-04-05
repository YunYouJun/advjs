<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'
import { useAdvContext } from '../../composables'

const buttonRef = useTemplateRef('buttonRef')

const { style } = useDraggable(buttonRef, {
  initialValue: {
    x: window.innerWidth - 80,
    y: window.innerHeight - 80,
  },
})
const showDevTools = ref(false)

const { $adv } = useAdvContext()
</script>

<template>
  <button
    ref="buttonRef"
    class="absolute bottom-6 right-6 z-9999 size-12 flex items-center justify-center rounded-full bg-dark shadow"
    :style="style"
    @click="showDevTools = !showDevTools"
  >
    ⚔️
  </button>

  <!-- overlay -->
  <div
    v-if="showDevTools"
    class="absolute bottom-0 left-0 right-0 top-0 z-9998 bg-black/50"
    @click="showDevTools = false"
  />

  <div
    v-if="showDevTools" absolute
    class="bottom-0 right-0 top-0 z-9999 min-w-md bg-dark p-4 text-white"
  >
    <div class="items-start text-left" flex="~ col" gap="4">
      <div>
        CurNode:
        <pre>{{ $adv.store.curNode }}</pre>
      </div>
      <div>
        FlowNode:

        <pre>{{ $adv.store.curFlowNode }}</pre>
      </div>

      <div>
        Tachies

        <pre>{{ $adv.$tachies.map.value }}</pre>
      </div>
    </div>
  </div>
</template>
