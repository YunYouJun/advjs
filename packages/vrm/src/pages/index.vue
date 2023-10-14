<script lang="ts" setup>
import type * as BABYLON from '@babylonjs/core'
import type { VRMManager } from 'babylon-vrm-loader'
import type { CameraInfo } from '@advjs/shared/debug'
import { captureCameraInfo } from '@advjs/shared/debug'
import { isClient } from '@vueuse/core'
import { useHead } from '@unhead/vue'
import { onMounted, ref } from 'vue'
import { setup } from '../setup'
import { useVrmStore } from '../stores/vrm'

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

const vrmManager = ref<VRMManager>()

const vrmStore = useVrmStore()

onMounted(async () => {
  if (!isClient)
    return
  const babylon = await setup(babylonCanvas.value, (manager) => {
    vrmManager.value = manager
  })
  babylon.scene.autoClear = true
  vrmStore.setBabylon(babylon)
})

/**
 * 记录镜头信息
 */
function recordCameraInfo() {
  cameraInfo.value = captureCameraInfo(vrmStore.babylon?.scene.activeCamera as BABYLON.ArcRotateCamera)
}
</script>

<template>
  <canvas ref="babylonCanvas" class="absolute inset-0 w-full h-full outline-none" />

  <VrmUi />

  <UploadVrm />

  <a target="_blank" href="https://github.com/YunYouJun/advjs">
    <AdvIconButton class="fixed right-50 bottom-5">
      <div i-ri-github-line text="white" />
    </AdvIconButton>
  </a>
  <AdvDebug>
    <AdvIconButton title="记录当前镜头位置" @click="recordCameraInfo()">
      <div i-ri-camera-line />
    </AdvIconButton>
    <pre class="block text-left">{{ JSON.stringify(cameraInfo, null, 2) }}</pre>
  </AdvDebug>
</template>

<route lang="yaml">
meta:
  layout: home
</route>
