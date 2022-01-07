<script setup lang="ts">
import { ref, watch } from 'vue'
import type * as BABYLON from '@babylonjs/core'
import { useBabylonStore } from '~/stores/babylon'
import type { CameraInfo } from '~/setup/debug/camera'
import { captureCameraInfo } from '~/setup/debug/camera'

const el = ref<HTMLElement | null>(null)
const open = ref(false)

const bStore = useBabylonStore()

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

watch(open, (value) => {
  if (!value)
    el.value!.scrollTop = 0
})

const setCameraInfo = (camera: BABYLON.ArcRotateCamera) => {
  if (!camera) return
  const info = captureCameraInfo(camera)
  if (info)
    cameraInfo.value = info
}

const sceneCamera = computed(() => bStore.instance?.scene?.activeCamera as BABYLON.ArcRotateCamera)
const vrmCamera = computed(() => bStore.instance?.vrmScene?.activeCamera as BABYLON.ArcRotateCamera)
</script>

<template>
  <AdvDebug>
    <AdvIconButton @click="setCameraInfo(sceneCamera)">
      <i-ri-camera-line />
    </AdvIconButton>
    <AdvIconButton @click="setCameraInfo(vrmCamera)">
      <i-ri-shield-user-line />
    </AdvIconButton>
    <pre class="block text-left">{{ JSON.stringify(cameraInfo, null, 2) }}</pre>
  </AdvDebug>
</template>

<style scoped>
.block {
  margin: 2px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  padding: 8px 16px;
  font-family: Hack, monospace;
  font-size: 13px;
}

.block + .block {
  margin-top: 8px;
}
</style>
