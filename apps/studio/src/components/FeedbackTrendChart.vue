<script setup lang="ts">
import type { CharacterChatMessage } from '../stores/useCharacterChatStore'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    messages: CharacterChatMessage[]
    /** Sliding window size for approval rate calculation */
    windowSize?: number
  }>(),
  {
    windowSize: 5,
  },
)

const { t } = useI18n()

const CHART_HEIGHT = 140
const PADDING = { top: 16, right: 16, bottom: 28, left: 40 }
const INNER_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom

const containerRef = ref<HTMLElement>()
const containerWidth = ref(360)

function updateWidth() {
  if (containerRef.value)
    containerWidth.value = containerRef.value.clientWidth
}

const innerWidth = computed(
  () => containerWidth.value - PADDING.left - PADDING.right,
)

/** Filter assistant messages that have feedback */
const feedbackMessages = computed(() =>
  props.messages.filter(m => m.role === 'assistant' && m.feedback),
)

/** Calculate sliding window approval rate */
const dataPoints = computed(() => {
  const msgs = feedbackMessages.value
  if (msgs.length < props.windowSize)
    return []

  const points: { index: number, rate: number, timestamp: number }[] = []
  for (let i = props.windowSize - 1; i < msgs.length; i++) {
    const window = msgs.slice(i - props.windowSize + 1, i + 1)
    const ups = window.filter(m => m.feedback === 'up').length
    const rate = (ups / window.length) * 100
    points.push({ index: i, rate, timestamp: msgs[i].timestamp })
  }
  return points
})

/** Total stats */
const stats = computed(() => {
  const msgs = feedbackMessages.value
  const ups = msgs.filter(m => m.feedback === 'up').length
  const downs = msgs.filter(m => m.feedback === 'down').length
  const total = ups + downs
  const rate = total > 0 ? Math.round((ups / total) * 100) : 0
  return { ups, downs, total, rate }
})

function xScale(index: number): number {
  const pts = dataPoints.value
  if (pts.length <= 1)
    return innerWidth.value / 2
  const minIdx = pts[0].index
  const maxIdx = pts.at(-1)!.index
  if (maxIdx === minIdx)
    return innerWidth.value / 2
  return ((index - minIdx) / (maxIdx - minIdx)) * innerWidth.value
}

function yScale(rate: number): number {
  return INNER_HEIGHT - (rate / 100) * INNER_HEIGHT
}

function buildPath(points: { x: number, y: number }[]): string {
  if (points.length === 0)
    return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
}

const linePath = computed(() => {
  const points = dataPoints.value.map(p => ({
    x: xScale(p.index),
    y: yScale(p.rate),
  }))
  return buildPath(points)
})

const areaPath = computed(() => {
  const pts = dataPoints.value
  if (pts.length === 0)
    return ''
  const points = pts.map(p => ({
    x: xScale(p.index),
    y: yScale(p.rate),
  }))
  const line = buildPath(points)
  const lastX = points.at(-1)!.x
  const firstX = points[0].x
  return `${line} L${lastX.toFixed(1)},${INNER_HEIGHT} L${firstX.toFixed(1)},${INNER_HEIGHT} Z`
})

const yLabels = [
  { value: 100, label: '100%' },
  { value: 50, label: '50%' },
  { value: 0, label: '0%' },
]

// Tooltip
const tooltip = ref<{ x: number, y: number, text: string } | null>(null)

function showTooltip(
  point: (typeof dataPoints.value)[number],
  event: MouseEvent,
) {
  tooltip.value = {
    x: event.offsetX,
    y: event.offsetY - 30,
    text: `${t('chat.feedbackRate')}: ${Math.round(point.rate)}%`,
  }
}

function hideTooltip() {
  tooltip.value = null
}
</script>

<template>
  <div ref="containerRef" class="ftc-container" @vue:mounted="updateWidth">
    <div v-if="feedbackMessages.length < windowSize" class="ftc-empty">
      {{ t("chat.feedbackTrendEmpty", { count: windowSize }) }}
    </div>
    <template v-else>
      <!-- Stats summary -->
      <div class="ftc-stats">
        <span class="ftc-stat"> 👍 {{ stats.ups }} </span>
        <span class="ftc-stat"> 👎 {{ stats.downs }} </span>
        <span class="ftc-stat ftc-stat--rate">
          {{ t("chat.feedbackRate") }}: {{ stats.rate }}%
        </span>
      </div>

      <div class="ftc-chart-wrapper">
        <svg :width="containerWidth" :height="CHART_HEIGHT" class="ftc-svg">
          <g :transform="`translate(${PADDING.left},${PADDING.top})`">
            <!-- Grid lines -->
            <line
              v-for="yl in yLabels"
              :key="yl.value"
              :x1="0"
              :y1="yScale(yl.value)"
              :x2="innerWidth"
              :y2="yScale(yl.value)"
              class="ftc-grid"
            />

            <!-- Area fill -->
            <path v-if="areaPath" :d="areaPath" class="ftc-area" />

            <!-- Line -->
            <path v-if="linePath" :d="linePath" class="ftc-line" />

            <!-- Data points -->
            <circle
              v-for="(pt, idx) in dataPoints"
              :key="idx"
              :cx="xScale(pt.index)"
              :cy="yScale(pt.rate)"
              r="3"
              class="ftc-dot"
              @mouseenter="showTooltip(pt, $event)"
              @mouseleave="hideTooltip"
            />

            <!-- Y-axis labels -->
            <text
              v-for="yl in yLabels"
              :key="`label-${yl.value}`"
              :x="-6"
              :y="yScale(yl.value)"
              class="ftc-axis-label"
              text-anchor="end"
              dominant-baseline="middle"
            >
              {{ yl.label }}
            </text>
          </g>
        </svg>

        <!-- Tooltip -->
        <div
          v-if="tooltip"
          class="ftc-tooltip"
          :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
        >
          {{ tooltip.text }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ftc-container {
  position: relative;
  width: 100%;
}

.ftc-empty {
  padding: 16px;
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 13px;
}

.ftc-stats {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--adv-text-secondary, var(--ion-color-medium));
}

.ftc-stat--rate {
  font-weight: 600;
  color: var(--adv-text-primary, var(--ion-text-color));
}

.ftc-chart-wrapper {
  position: relative;
}

.ftc-svg {
  display: block;
}

.ftc-grid {
  stroke: var(--ion-color-light-shade, #e0e0e0);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.ftc-area {
  fill: rgba(76, 175, 80, 0.1);
}

.ftc-line {
  fill: none;
  stroke: #4caf50;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ftc-dot {
  fill: #4caf50;
  opacity: 0.7;
  cursor: pointer;
  transition: opacity 0.15s;
}

.ftc-dot:hover {
  opacity: 1;
  r: 5;
}

.ftc-axis-label {
  font-size: 10px;
  fill: var(--ion-color-medium, #999);
}

.ftc-tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
  transform: translateX(-50%);
}
</style>
