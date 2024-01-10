<script lang="ts" setup>
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import AGUIOverlay from '../AGUIOverlay.vue'
import { curDirHandle, onOpenDir, setAssetsDirHandle, vscodeFolderIcon } from './useAssetsExplorer'

const isDragging = ref(false)

const openDirectoryRef = ref<HTMLDivElement>()
useEventListener(openDirectoryRef, 'dragover', (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
})

function onDragLeave() {
  isDragging.value = false
}
useEventListener(openDirectoryRef, 'dragleave', onDragLeave)
useEventListener(openDirectoryRef, 'dragend', onDragLeave)

useEventListener(openDirectoryRef, 'drop', async (e) => {
  isDragging.value = false
  e.preventDefault()
  e.stopPropagation()

  const dirHandle = await e.dataTransfer?.items[0].getAsFileSystemHandle()
  if (dirHandle?.kind === 'directory') {
    const handle = dirHandle as FileSystemDirectoryHandle
    setAssetsDirHandle(handle)
    curDirHandle.value = handle
  }
})
</script>

<template>
  <div ref="openDirectoryRef" class="agui-open-directory relative h-full w-full flex flex-col items-center justify-center">
    <div class="icon cursor-pointer text-6xl">
      <div
        :class="vscodeFolderIcon"
        @click="onOpenDir"
      />
    </div>
    <div class="text-base">
      Open a directory to start
    </div>

    <AGUIOverlay v-if="isDragging" class="pointer-events-none" />
  </div>
</template>

<style lang="scss">
.agui-open-directory {
  .icon {
    will-change: filter;
    transition: filter 300ms;

    &:hover {
      filter: drop-shadow(0 0 1rem rgba(192, 149, 83, 0.9));
    }
  }
}
</style>
