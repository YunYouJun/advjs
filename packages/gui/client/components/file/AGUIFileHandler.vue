<script setup lang="ts">
import { ref } from 'vue'

import { useEventListener } from '@vueuse/core'

defineProps<{
  placeholder?: string
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
useEventListener(areaRef, 'drop', (e) => {
  e.preventDefault()
  e.stopPropagation()

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
    <!-- <input
      class="h-30px w-full"
      type="file"
      accept="image/*"
      @change="onFileChange"
    > -->

    <span text-xs op="50">
      {{ placeholder || 'Drag File Here' }}
    </span>
  </div>
</template>
