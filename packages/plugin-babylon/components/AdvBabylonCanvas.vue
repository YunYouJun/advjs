<script lang="ts" setup>
import { isClient } from '@vueuse/core'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { createCameraAnimation, setup, useBabylonStore } from '@advjs/plugin-babylon'
import type * as BABYLON from '@babylonjs/core'
import type { AdvAst } from '@advjs/types'
import { useAdvCtx } from '@advjs/client'

const $adv = useAdvCtx()

const bStore = useBabylonStore()

const babylonCanvas = ref()

onMounted(async () => {
  if (!isClient)
    return
  const instance = await setup(babylonCanvas.value)
  bStore.setInstance(instance)
})

onUnmounted(() => {
  if (bStore.instance)
    bStore.instance.dispose()
})

watch(() => $adv.store.curNode, (node) => {
  if (node?.type !== 'code')
    return

  const scene = bStore.instance?.scene
  if (scene && Array.isArray(node.value)) {
    node.value?.forEach((node: AdvAst.CodeOperation) => {
      if (node.type === 'camera')
        createCameraAnimation(scene as BABYLON.Scene, node)
    })
  }
})
</script>

<template>
  <div class="absolute h-full w-full">
    <canvas ref="babylonCanvas" class="h-full w-full outline-none" />
  </div>
</template>
