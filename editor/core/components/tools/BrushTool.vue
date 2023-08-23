<script lang="ts" setup>
import { createBrush } from '@advjs/editor/utils'

const app = useAppStore()
const active = ref(false)

const brush = useBrushStore()

function onClick() {
  createBrush(app.pixiApp)
  active.value = true
}
</script>

<template>
  <div inline-flex>
    <AGUIIconButton :active="active" mx-0.5 icon="i-ri-brush-line" @click="onClick" />
    <AGUIIconButton mx-0.5 icon="i-ri-eraser-line" />
  </div>
  <AGUIInputNumber v-model="brush.size" mx-0.5 w-16 />
</template>
