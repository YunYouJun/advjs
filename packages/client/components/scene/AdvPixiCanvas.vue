<script lang="ts" setup>
import { isClient } from '@vueuse/core'
import { onMounted, ref } from 'vue'
import { useAdvConfig } from '../../composables'
import { initPixi } from '../../pixi'

const pixiCanvasRef = ref<HTMLCanvasElement>()
const advConfig = useAdvConfig()

onMounted(async () => {
  if (!isClient || !pixiCanvasRef.value)
    return

  await initPixi(pixiCanvasRef.value, advConfig.value)
})
</script>

<template>
  <canvas id="pixi-canvas" ref="pixiCanvasRef" class="h-full w-full" />
</template>
