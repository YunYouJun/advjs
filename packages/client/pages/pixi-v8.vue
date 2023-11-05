<script lang="ts" setup>
import type { ICanvas } from 'pixi.js'
import { autoDetectRenderer } from 'pixi.js'
import { onMounted, ref } from 'vue'

import * as PIXI from 'pixi.js'

const pixiCanvasRef = ref<HTMLCanvasElement>()

async function init() {
  if (!pixiCanvasRef.value)
    return
  const renderer = await autoDetectRenderer({
    canvas: pixiCanvasRef.value as ICanvas,
    // any settings
  }) // will return a WebGL or WebGPU renderer

  // eslint-disable-next-line no-console
  console.log(renderer)

  const app = new PIXI.Application()
  await app.init({
    canvas: pixiCanvasRef.value as ICanvas,
    // view: pixiCanvasRef.value,
    background: '#1099bb',
  })

  const bunny = PIXI.Sprite.from('https://pixijs.com/assets/bunny.png')
  app.stage.addChild(bunny)

  // center the sprite's anchor point
  bunny.anchor.set(0.5)

  // move the sprite to the center of the screen
  bunny.x = app.screen.width / 2
  bunny.y = app.screen.height / 2
}

onMounted(async () => {
  await init()
})
</script>

<template>
  <div>
    PIXI V8
    <canvas id="pixi-canvas" ref="pixiCanvasRef" />
  </div>
</template>
