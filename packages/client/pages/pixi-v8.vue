<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { initPixi } from '../pixi'

const pixiCanvasRef = ref<HTMLCanvasElement>()

onMounted(async () => {
  if (!pixiCanvasRef.value)
    return

  await initPixi(pixiCanvasRef.value)
})
</script>

<template>
  <div>
    PIXI V8
    <canvas id="pixi-canvas" ref="pixiCanvasRef" />
  </div>
</template>
