<script lang="ts" setup>
import { isClient } from '@vueuse/core'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { createCameraAnimation } from '@advjs/plugin-babylon'
import type * as BABYLON from '@babylonjs/core'
import type { AdvAst } from '@advjs/types'
import { setup } from '~/setup/babylon'
import { useAdvCtx } from '~/setup/adv'
import { useBabylonStore } from '~/stores/babylon'

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
  <div class="w-full h-full absolute">
    <canvas ref="babylonCanvas" class="w-full h-full outline-none" />
  </div>
</template>
