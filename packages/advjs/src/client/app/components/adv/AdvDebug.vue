<script setup lang="ts">
import { ref, watch } from 'vue'
import type * as BABYLON from 'babylonjs'
import { useBabylonStore } from '~/stores/babylon'

const el = ref<HTMLElement | null>(null)
const open = ref(false)

const bStore = useBabylonStore()

const cameraInfo = reactive({
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

const captureCameraInfo = () => {
  const camera = bStore.activeScene?.activeCamera as BABYLON.ArcRotateCamera
  cameraInfo.target.x = camera.target.x
  cameraInfo.target.y = camera.target.y
  cameraInfo.target.z = camera.target.z

  cameraInfo.alpha = camera.alpha
  cameraInfo.beta = camera.beta
  cameraInfo.radius = camera.radius
}
</script>

<template>
  <div ref="el" class="debug" :class="{ open }">
    <AdvIconButton class="fixed bottom-5 right-5" @click="open = !open">
      <i-ri-bug-line color="white" />
    </AdvIconButton>

    <div v-show="open" p="2">
      <AdvIconButton @click="captureCameraInfo">
        <i-ri-camera-line />
      </AdvIconButton>
      <pre class="block text-left">{{ JSON.stringify(cameraInfo, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
.debug {
  box-sizing: border-box;
  position: fixed;
  right: 8px;
  bottom: 8px;
  z-index: 9999;
  color: #eee;
  overflow: hidden;
  cursor: pointer;
  background-color: rgba(0, 0, 0, 0.85);
  transition: all 0.15s ease;
}

.debug:hover {
  background-color: rgba(0, 0, 0, 0.75);
}

.debug.open {
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  margin-top: 0;
  border-radius: 0;
  padding: 0 0;
  overflow: auto;
}

@media (min-width: 512px) {
  .debug.open {
    width: 512px;
  }
}

.debug.open:hover {
  background-color: rgba(0, 0, 0, 0.85);
}

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
