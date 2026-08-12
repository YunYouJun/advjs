<script setup lang="ts">
import type { AdvActivityRendererEmits, AdvActivityRendererProps } from '@advjs/client'
import { computed, ref, watch } from 'vue'
import './style.css'

const props = defineProps<AdvActivityRendererProps>()
const emit = defineEmits<AdvActivityRendererEmits>()

const STAR_POINTS = [
  [18, 28],
  [34, 18],
  [48, 39],
  [63, 22],
  [79, 34],
  [28, 67],
  [52, 72],
  [73, 62],
  [87, 77],
] as const
const rotation = ref(-18)
const scale = ref(0.84)
const dragging = ref(false)
let lastAngle = 0

const tolerance = computed(() => {
  const value = props.activity.input.tolerance
  return typeof value === 'number' ? clamp(value) : 0.82
})
const starCount = computed(() => {
  const value = props.activity.input.stars
  return typeof value === 'number' ? Math.max(3, Math.min(STAR_POINTS.length, Math.trunc(value))) : 7
})
const points = computed(() => STAR_POINTS.slice(0, starCount.value))
const score = computed(() => clamp(1 - Math.abs(rotation.value) / 72 - Math.abs(1 - scale.value) * 0.7))
const matched = computed(() => score.value >= tolerance.value)
const transform = computed(() => `rotate(${rotation.value}deg) scale(${scale.value})`)

watch(() => props.activity.id, reset)

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function reset() {
  rotation.value = -18
  scale.value = 0.84
}

function angle(event: PointerEvent): number {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)) * 180 / Math.PI
}

function pointerDown(event: PointerEvent) {
  dragging.value = true
  lastAngle = angle(event)
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}

function pointerMove(event: PointerEvent) {
  if (!dragging.value)
    return
  const next = angle(event)
  rotation.value = Math.max(-45, Math.min(45, rotation.value + next - lastAngle))
  lastAngle = next
}

function pointerUp() {
  dragging.value = false
}

function wheel(event: WheelEvent) {
  scale.value = Math.max(0.72, Math.min(1.18, scale.value - event.deltaY * 0.0008))
}

function keydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft')
    rotation.value = Math.max(-45, rotation.value - 1)
  else if (event.key === 'ArrowRight')
    rotation.value = Math.min(45, rotation.value + 1)
  else if (event.key === 'ArrowUp')
    scale.value = Math.min(1.18, scale.value + 0.01)
  else if (event.key === 'ArrowDown')
    scale.value = Math.max(0.72, scale.value - 0.01)
  else
    return
  event.preventDefault()
}

function complete() {
  emit('complete', { matched: matched.value, score: Number(score.value.toFixed(2)) })
}
</script>

<template>
  <div class="interaction-activity star-map-activity">
    <header class="interaction-activity__header">
      <div>
        <p class="interaction-activity__eyebrow">
          ORBITAL COMPARISON
        </p>
        <h2 class="interaction-activity__title">
          星图比对
        </h2>
      </div>
      <output :class="{ matched }">{{ Math.round(score * 100) }}%</output>
    </header>

    <p class="interaction-activity__description">
      拖动星盘校准角度，滚轮或上下方向键缩放。星点越接近参考轨迹，比对率越高。
    </p>

    <div
      class="star-map"
      :class="{ 'is-dragging': dragging }"
      tabindex="0"
      role="application"
      aria-label="可旋转和缩放的星图"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="pointerUp"
      @wheel.prevent="wheel"
      @keydown="keydown"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <g class="star-map__reference">
          <circle v-for="point in points" :key="`r-${point[0]}-${point[1]}`" :cx="point[0]" :cy="point[1]" r="1.15" />
          <polyline :points="points.map(point => point.join(',')).join(' ')" />
        </g>
        <g class="star-map__candidate" :style="{ transform }">
          <circle v-for="point in points" :key="`c-${point[0]}-${point[1]}`" :cx="point[0]" :cy="point[1]" r="1.5" />
          <polyline :points="points.map(point => point.join(',')).join(' ')" />
        </g>
      </svg>
      <span class="star-map__reticle" />
    </div>

    <div class="star-map__fine-controls">
      <label>
        <span>旋转</span>
        <input v-model.number="rotation" data-testid="rotation" type="range" min="-45" max="45" step="1">
        <output>{{ rotation.toFixed(0) }}°</output>
      </label>
      <label>
        <span>缩放</span>
        <input v-model.number="scale" data-testid="scale" type="range" min="0.72" max="1.18" step="0.01">
        <output>{{ scale.toFixed(2) }}</output>
      </label>
    </div>

    <div class="interaction-activity__actions">
      <button type="button" class="secondary" @click="emit('back')">
        返回
      </button>
      <button type="button" class="secondary" @click="reset">
        重置星图
      </button>
      <button type="button" :disabled="!matched" @click="complete">
        确认轨迹
      </button>
    </div>
  </div>
</template>
