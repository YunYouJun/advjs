<script setup lang="ts">
import type { ThreeSceneSetup, ThreeViewport, ThreeViewportOptions } from '@advjs/plugin-three'
import type { Intersection } from 'three'
import { createThreeViewport } from '@advjs/plugin-three'
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowRef, useTemplateRef, watch } from 'vue'

const props = withDefaults(defineProps<{
  label?: string
  active?: boolean
  options?: ThreeViewportOptions
  setup?: ThreeSceneSetup
}>(), { label: '3D scene', active: true })
const emit = defineEmits<{
  ready: [viewport: ThreeViewport]
  pick: [intersection: Intersection | undefined]
  error: [error: Error]
}>()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const viewport = shallowRef<ThreeViewport>()
const error = shallowRef<Error>()
let cleanup: (() => void) | undefined
let pointer: { id: number, x: number, y: number, moved: boolean } | undefined
let mounted = false
let activated = true

function report(cause: unknown) {
  error.value = cause instanceof Error ? cause : new Error(String(cause))
  emit('error', error.value)
}

function dispose() {
  pointer = undefined
  try {
    cleanup?.()
  }
  finally {
    cleanup = undefined
    viewport.value?.dispose()
    viewport.value = undefined
  }
}

function initialize() {
  if (!canvas.value || !mounted)
    return
  try {
    dispose()
    error.value = undefined
    const current = createThreeViewport(canvas.value, {
      ...props.options,
      onError(cause) {
        report(cause)
        props.options?.onError?.(cause)
      },
      onContextChange(lost) {
        if (lost)
          report(new Error('WebGL context lost'))
        else
          error.value = undefined
        props.options?.onContextChange?.(lost)
      },
    })
    viewport.value = current
    cleanup = props.setup?.(current) || undefined
    current.setActive(props.active && activated)
    current.invalidate()
    emit('ready', current)
  }
  catch (cause) {
    dispose()
    report(cause)
  }
}

function pointerDown(event: PointerEvent) {
  if (event.button === 0)
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
}

function pointerMove(event: PointerEvent) {
  if (pointer && pointer.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5)
    pointer.moved = true
}

function pointerUp(event: PointerEvent) {
  const start = pointer
  pointer = undefined
  if (start && !start.moved && start.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 5)
    emit('pick', viewport.value?.pick(event.clientX, event.clientY))
}

onMounted(() => {
  mounted = true
  initialize()
})
watch(() => [props.options, props.setup], initialize)
watch(() => props.active, value => viewport.value?.setActive(value && activated))
onActivated(() => {
  activated = true
  viewport.value?.setActive(props.active)
})
onDeactivated(() => {
  activated = false
  viewport.value?.setActive(false)
})
onBeforeUnmount(() => {
  mounted = false
  dispose()
})
defineExpose({ viewport, retry: initialize })
</script>

<template>
  <div class="adv-three-canvas" @click.stop>
    <canvas
      ref="canvas" role="img" :aria-label="label" class="adv-three-canvas__surface"
      @pointerdown.stop="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointer = undefined"
    />
    <div v-if="error" class="adv-three-canvas__error" role="alert">
      <slot name="error" :error="error" :retry="initialize">
        {{ error.message }}
      </slot>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.adv-three-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
.adv-three-canvas__surface {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.adv-three-canvas__error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--adv-c-text, currentColor);
}
</style>
