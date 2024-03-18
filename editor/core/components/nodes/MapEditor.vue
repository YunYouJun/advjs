<script lang="ts" setup>
import { init } from '~/utils/map'

const mapCanvasContainer = ref<HTMLDivElement>()
const mapCanvas = ref<HTMLCanvasElement>()

onMounted(() => {
  if (!mapCanvas.value || !mapCanvasContainer.value)
    return
  init(mapCanvas.value)
})
</script>

<template>
  <div ref="mapCanvasContainer" class="h-full w-full">
    <canvas ref="mapCanvas" h-full w-full border-none outline-none focus:outline-none />
  </div>
</template>
