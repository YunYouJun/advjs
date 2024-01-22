<script setup lang="ts">
import { ref } from 'vue'

import { useEventListener } from '@vueuse/core'
import type { FSItem } from '../explorer'

const props = defineProps<{
  placeholder?: string
  onFileChange?: (file?: FSItem) => (void | Promise<void>)
}>()

// function onFileChange(e: Event) {
//   const target = e.target as HTMLInputElement
//   const file = target.files?.[0]
//   if (!file)
//     return

//   const reader = new FileReader()
//   reader.onload = (e) => {
//     const result = e.target?.result
//     if (typeof result !== 'string')
//       return

//     consola.info(result)
//   }
//   reader.readAsDataURL(file)
// }

const areaRef = ref<HTMLDivElement>()

const isDraggingOver = ref(false)
const fileItem = ref<FSItem>()

useEventListener(areaRef, 'dragenter', (e) => {
  e.preventDefault()
  e.stopPropagation()
  isDraggingOver.value = true
})
useEventListener(areaRef, 'dragover', (e) => {
  e.preventDefault()
  e.stopPropagation()
  isDraggingOver.value = true
})

function onDragLeave(e: any) {
  e.preventDefault()
  e.stopPropagation()

  isDraggingOver.value = false
}
useEventListener(areaRef, 'dragleave', onDragLeave)
useEventListener(areaRef, 'dragend', onDragLeave)
useEventListener(areaRef, 'drop', async (e) => {
  e.preventDefault()
  e.stopPropagation()

  const fileUUID = e.dataTransfer?.getData('fileUUID')
  if (fileUUID) {
    fileItem.value = window.AGUI_DRAGGING_ITEM_MAP.get(fileUUID)
    window.AGUI_DRAGGING_ITEM_MAP.delete(fileUUID)
    await props.onFileChange?.(fileItem.value)
  }

  onDragLeave(e)
})
</script>

<template>
  <div
    ref="areaRef"
    class="h-20px flex items-center justify-center rounded"
    :class="{
      'bg-$agui-c-active': isDraggingOver,
      'bg-dark': !isDraggingOver,
    }"
  >
    <span v-if="fileItem?.name" class="text-xs">
      {{ fileItem?.name }}
    </span>
    <span v-else text-xs op="50">
      {{ placeholder || 'Drag File Here' }}
    </span>
  </div>
</template>
