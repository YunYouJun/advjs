<template>
  <canvas ref="babylonCanvas" class="absolute inset-0 w-full h-full outline-none" />
  <AdvDebug>
    <AdvIconButton title="记录当前镜头位置" @click="recordCameraInfo()">
      <i-ri-camera-line />
    </AdvIconButton>
    <pre class="block text-left">{{ JSON.stringify(cameraInfo, null, 2) }}</pre>
  </AdvDebug>
  <VrmUi :vrm-manager="vrmManager" />
</template>

<route lang="yaml">
meta:
  layout: fullscreen
</route>

<script lang="ts" setup>
import type * as BABYLON from '@babylonjs/core'
import type { VRMManager } from 'babylon-vrm-loader'
import { setup } from '~/setup/vrm'
import { isClient } from '~/utils'

import type { CameraInfo } from '~/setup/debug/camera'
import { captureCameraInfo } from '~/setup/debug/camera'

useHead({
  title: 'ADV.JS VRM 模型调试工具',
  meta: [
    { name: 'description', content: 'ADV.JS VRM 模型调试工具' },
  ],
})

const cameraInfo = ref<CameraInfo>({
  target: {
    x: 0,
    y: 0,
    z: 0,
  },
  alpha: 0,
  beta: 0,
  radius: 0,
})

const babylonCanvas = ref()

let babylon: {
  scene: BABYLON.Scene
  engine: BABYLON.Engine
}

const vrmManager = ref<VRMManager>()

onMounted(async() => {
  if (!isClient) return
  babylon = await setup(babylonCanvas.value, (manager) => {
    vrmManager.value = manager
  })
  babylon.scene.autoClear = true
})

/**
 * 记录镜头信息
 */
const recordCameraInfo = () => {
  cameraInfo.value = captureCameraInfo(babylon.scene.activeCamera as BABYLON.ArcRotateCamera)
}
</script>
