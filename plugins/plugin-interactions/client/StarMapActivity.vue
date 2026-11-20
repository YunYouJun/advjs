<script setup lang="ts">
import type { AdvActivityRendererEmits, AdvActivityRendererProps } from '@advjs/client'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { activityMessages } from './messages'
import './style.css'

const props = defineProps<AdvActivityRendererProps>()
const emit = defineEmits<AdvActivityRendererEmits>()
const { locale, t } = useI18n({ useScope: 'local', messages: activityMessages })

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
const rotationRange = { min: -45, max: 45, step: 1 }
const scaleRange = { min: 0.72, max: 1.18, step: 0.01 }
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
const rotationFill = computed(() => rangeFill(rotation.value, rotationRange))
const scaleFill = computed(() => rangeFill(scale.value, scaleRange))

watch(() => props.activity.id, reset)

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function rangeFill(value: number, { min, max }: { min: number, max: number }) {
  return `${100 * clamp((value - min) / (max - min))}%`
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
  rotation.value = Math.max(rotationRange.min, Math.min(rotationRange.max, rotation.value + next - lastAngle))
  lastAngle = next
}

function pointerUp() {
  dragging.value = false
}

function wheel(event: WheelEvent) {
  scale.value = Math.max(scaleRange.min, Math.min(scaleRange.max, scale.value - event.deltaY * 0.0008))
}

function keydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft')
    rotation.value = Math.max(rotationRange.min, rotation.value - rotationRange.step)
  else if (event.key === 'ArrowRight')
    rotation.value = Math.min(rotationRange.max, rotation.value + rotationRange.step)
  else if (event.key === 'ArrowUp')
    scale.value = Math.min(scaleRange.max, scale.value + scaleRange.step)
  else if (event.key === 'ArrowDown')
    scale.value = Math.max(scaleRange.min, scale.value - scaleRange.step)
  else
    return
  event.preventDefault()
}

function complete() {
  emit('complete', { matched: matched.value, score: Number(score.value.toFixed(2)) })
}
</script>

<template>
  <div class="interaction-activity star-map-activity" :lang="locale">
    <header class="interaction-activity__header">
      <div>
        <p class="interaction-activity__eyebrow">
          {{ t('starMap.instrument') }}
        </p>
        <h2 class="interaction-activity__title">
          {{ t('starMap.title') }}
        </h2>
      </div>
      <output :class="{ matched }">{{ Math.round(score * 100) }}%</output>
    </header>

    <p class="interaction-activity__description">
      {{ t('starMap.description') }}
    </p>

    <div
      class="star-map"
      :class="{ 'is-dragging': dragging }"
      tabindex="0"
      role="application"
      :aria-label="t('starMap.map')"
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
        <span>{{ t('starMap.rotation') }}</span>
        <input
          v-model.number="rotation"
          v-bind="rotationRange"
          :style="{ '--interaction-range-fill': rotationFill }"
          :aria-valuetext="`${rotation.toFixed(0)}°`"
          data-testid="rotation"
          type="range"
        >
        <output aria-hidden="true">{{ rotation.toFixed(0) }}°</output>
      </label>
      <label>
        <span>{{ t('starMap.zoom') }}</span>
        <input
          v-model.number="scale"
          v-bind="scaleRange"
          :style="{ '--interaction-range-fill': scaleFill }"
          data-testid="scale"
          type="range"
        >
        <output aria-hidden="true">{{ scale.toFixed(2) }}</output>
      </label>
    </div>

    <div class="interaction-activity__actions">
      <button type="button" class="secondary" @click="emit('back')">
        {{ t('back') }}
      </button>
      <button type="button" class="secondary" @click="reset">
        {{ t('starMap.reset') }}
      </button>
      <button type="button" :disabled="!matched" @click="complete">
        {{ t('starMap.confirm') }}
      </button>
    </div>
  </div>
</template>
