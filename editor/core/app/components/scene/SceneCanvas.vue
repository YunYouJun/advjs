<script lang="ts" setup>
import type { Painter } from 'pixi-painter'
import { createPainter } from 'pixi-painter'

const sceneCanvasContainer = ref<HTMLDivElement>()
const sceneCanvas = ref<HTMLCanvasElement>()

let painter: Painter
onMounted(async () => {
  if (!sceneCanvas.value || !sceneCanvasContainer.value)
    return

  await nextTick()
  if (painter)
    return

  painter = createPainter({
    view: sceneCanvas.value,
    size: {
      width: sceneCanvasContainer.value.clientWidth,
      height: sceneCanvasContainer.value.clientHeight,
    },
  })
  painter.init()
})
</script>

<template>
  <div ref="sceneCanvasContainer" class="h-full w-full">
    <canvas ref="sceneCanvas" h-full w-full border-none outline-none focus:outline-none />
  </div>
</template>
