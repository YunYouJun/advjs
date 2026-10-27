<script setup lang="ts">
import type { FSItem } from '../explorer'

import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

const props = defineProps<{
  placeholder?: string
  disabled?: boolean
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
  isDraggingOver.value = !props.disabled
})
useEventListener(areaRef, 'dragover', (e) => {
  e.preventDefault()
  e.stopPropagation()
  isDraggingOver.value = !props.disabled
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
  if (props.disabled)
    return

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
    class="agui-file-handler"
    :class="{ 'is-dragging': isDraggingOver && !disabled, 'is-disabled': disabled }"
    :aria-disabled="disabled || undefined"
  >
    <span v-if="fileItem?.name" class="text-xs">
      {{ fileItem?.name }}
    </span>
    <span v-else text-xs op="50">
      {{ placeholder || 'Drag File Here' }}
    </span>
  </div>
</template>

<style scoped>
.agui-file-handler {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: var(--agui-control-height);
  padding: 2px var(--agui-control-padding-x);
  font-family: var(--agui-font-family-ui);
  color: var(--agui-c-text-1);
  background: var(--agui-c-field);
  border: 1px solid var(--agui-c-control-border);
  border-radius: var(--agui-radius-sm);
  overflow-wrap: anywhere;
}
.agui-file-handler.is-dragging {
  color: var(--agui-c-selection-text);
  background: var(--agui-c-selection);
  border-color: var(--agui-c-focus);
}
.agui-file-handler.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
