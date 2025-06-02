<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'
import { useAdvContext } from '../../composables'
import { ADV_RUNTIME } from '../../utils'

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
    class="bottom-0 right-0 top-0 z-9999 max-w-2xl min-w-md overflow-auto bg-dark p-4 text-white"
  >
    <div class="items-start text-left" flex="~ col" gap="4">
      <div>
        <h3 class="text-lg font-bold">
          CurNode:
        </h3>
        <pre>{{ $adv.store.curNode }}</pre>
      </div>
      <div>
        <h3 class="text-lg font-bold">
          FlowNode:
        </h3>
        <pre>{{ $adv.store.curFlowNode }}</pre>
      </div>

      <div>
        <h3 class="text-lg font-bold">
          Cur Dialog
        </h3>
        <pre>{{ $adv.store.cur.dialog }}</pre>
      </div>

      <div>
        <h3 class="text-lg font-bold">
          Tachies:
        </h3>
        <pre>{{ ADV_RUNTIME.tachiesMapRef }}</pre>
      </div>

      <div>
        <h3 class="text-lg font-bold">
          Config:
        </h3>
        <pre>{{ $adv.config }}</pre>
      </div>
    </div>
  </div>
</template>
