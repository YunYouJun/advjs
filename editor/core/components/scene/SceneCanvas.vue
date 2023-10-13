<script lang="ts" setup>
import * as PIXI from 'pixi.js'

import { createExampleScene } from '@advjs/editor/utils'

const sceneCanvasContainer = ref<HTMLDivElement>()
const sceneCanvas = ref<HTMLCanvasElement>()

function createRuntime(options: {
  container: HTMLDivElement
  canvas: HTMLCanvasElement
}) {
  const { container, canvas } = options
  const app = new PIXI.Application({
    view: canvas,
    // resolution: window.devicePixelRatio || 1,
    resizeTo: container,
    antialias: true,
  })
  // @ts-expect-error for pixi chrome plugin
  globalThis.__PIXI_APP__ = app

  return app
}

const app = useAppStore()

onMounted(() => {
  if (!sceneCanvas.value || !sceneCanvasContainer.value)
    return

  const pixiApp = createRuntime({
    container: sceneCanvasContainer.value,
    canvas: sceneCanvas.value,
  })
  app.pixiApp = pixiApp

  createExampleScene(pixiApp)
})
</script>

<template>
  <div ref="sceneCanvasContainer" class="h-full w-full">
    <canvas ref="sceneCanvas" h-full w-full border-none outline-none focus:outline-none />
  </div>
</template>
