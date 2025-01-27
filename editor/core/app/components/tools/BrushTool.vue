<script lang="ts" setup>
import { PainterBrush } from 'pixi-painter'

const active = ref(false)

const brush = useBrushStore()
</script>

<template>
  <div inline-flex>
    <AGUIIconButton :active="active" mx-0.5 icon="i-ri-brush-line" />
    <AGUIIconButton mx-0.5 icon="i-ri-eraser-line" />
  </div>
  <!-- <AGUIColorPicker v-model="brush.color" mx-0.5 /> -->
  <input v-model="PainterBrush.color" type="color" mx-0.5>
  <AGUIInputNumber v-model="brush.size" :min="1" mx-0.5 w-16 />
</template>
