<script lang="ts" setup>
import type * as BABYLON from '@babylonjs/core'
import { isVrmModel } from '@advjs/core'
import { createVRM, getVrmManager } from '@advjs/plugin-babylon'
import { onMounted, ref } from 'vue'
import { useVrmStore } from '../stores/vrm'

const vrmStore = useVrmStore()

const showDragStyle = ref(false)

/**
 * 拖拽
 */
function onDragEnter(e: DragEvent) {
  e.preventDefault()
  showDragStyle.value = true
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  showDragStyle.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  showDragStyle.value = false

  const fileList = e.dataTransfer?.files
  if (!fileList?.length)
    return
  if (isVrmModel(fileList[0])) {
    const scene = vrmStore.scene as BABYLON.Scene

    // dispose old vrmManager
    const manager = getVrmManager(scene)
    if (!manager)
      return
    manager.rootMesh.dispose()
    manager.dispose()

    if (scene) {
      createVRM(scene, 'file:', fileList[0], () => {
        const manager = getVrmManager(scene)
        if (!manager)
          return

        const vrmManager = getVrmManager(scene)
        vrmStore.setVrmManager(vrmManager)
      })
    }
  }
}

onMounted(() => {
  document.addEventListener('dragenter', onDragEnter)
  document.addEventListener('dragover', onDragOver)
  document.addEventListener('dragleave', onDragLeave)
  document.addEventListener('drop', onDrop)
})
</script>

<template>
  <div
    class="pointer-events-none absolute top-0 z-10 h-full w-full flex items-center justify-center" :class="showDragStyle ? ['bg-black bg-opacity-50 border border-4 border-black border-dashed'] : ''" text="2xl white"
  >
    <span v-show="showDragStyle">Drag .vrm file</span>
  </div>
</template>
