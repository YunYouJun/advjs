<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { isClient } from '@vueuse/core'
import { initPixi } from '../../pixi'
import { useAdvConfig } from '../../composables'

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
