<script setup lang="ts">
import type { EmotionalSnapshot } from '../stores/useCharacterMemoryStore'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getMoodEmoji } from '../utils/chatUtils'

const props = defineProps<{
  history: EmotionalSnapshot[]
}>()

const { t } = useI18n()

const CHART_HEIGHT = 180
const PADDING = { top: 20, right: 16, bottom: 30, left: 40 }
const INNER_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom

// Use a ref for container width (responsive)
const containerRef = ref<HTMLElement>()
const containerWidth = ref(360)

function updateWidth() {
  if (containerRef.value)
    containerWidth.value = containerRef.value.clientWidth
}

const innerWidth = computed(() => containerWidth.value - PADDING.left - PADDING.right)

// Time range
const timeRange = computed(() => {
  if (props.history.length < 2)
    return { min: 0, max: 1 }
  const timestamps = props.history.map(s => s.timestamp)
  return { min: Math.min(...timestamps), max: Math.max(...timestamps) }
})

function xScale(timestamp: number): number {
  const { min, max } = timeRange.value
  if (max === min)
    return innerWidth.value / 2
  return ((timestamp - min) / (max - min)) * innerWidth.value
}

// affinity: -100 to 100 → INNER_HEIGHT to 0
function yAffinity(value: number): number {
  return INNER_HEIGHT - ((value + 100) / 200) * INNER_HEIGHT
}

// trust: 0 to 100 → INNER_HEIGHT to 0
function yTrust(value: number): number {
  return INNER_HEIGHT - (value / 100) * INNER_HEIGHT
}

function buildPath(points: { x: number, y: number }[]): string {
  if (points.length === 0)
    return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

const affinityPath = computed(() => {
  const points = props.history.map(s => ({
    x: xScale(s.timestamp),
    y: yAffinity(s.affinity),
  }))
  return buildPath(points)
})

const trustPath = computed(() => {
  const points = props.history.map(s => ({
    x: xScale(s.timestamp),
    y: yTrust(s.trust),
  }))
  return buildPath(points)
})

const moodPoints = computed(() => {
  return props.history.map(s => ({
    x: xScale(s.timestamp),
    y: yAffinity(s.affinity),
    mood: s.mood,
    emoji: getMoodEmoji(s.mood),
    timestamp: s.timestamp,
    affinity: s.affinity,
    trust: s.trust,
  }))
})

// Y-axis labels for affinity
const yLabels = [
  { value: 100, label: '100' },
  { value: 0, label: '0' },
  { value: -100, label: '-100' },
]

// X-axis date labels (show first, middle, last)
const xLabels = computed(() => {
  const h = props.history
  if (h.length === 0)
    return []
  const fmt = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (h.length === 1)
    return [{ x: xScale(h[0].timestamp), label: fmt(h[0].timestamp) }]
  const labels = [
    { x: xScale(h[0].timestamp), label: fmt(h[0].timestamp) },
    { x: xScale(h.at(-1)!.timestamp), label: fmt(h.at(-1)!.timestamp) },
  ]
  if (h.length > 2) {
    const mid = h[Math.floor(h.length / 2)]
    labels.splice(1, 0, { x: xScale(mid.timestamp), label: fmt(mid.timestamp) })
  }
  return labels
})

// Tooltip
const tooltip = ref<{ x: number, y: number, text: string } | null>(null)

function showTooltip(point: typeof moodPoints.value[number], event: MouseEvent) {
  const date = new Date(point.timestamp).toLocaleString()
  tooltip.value = {
    x: event.offsetX,
    y: event.offsetY - 30,
    text: `${point.emoji} ${point.mood} | A:${point.affinity} T:${point.trust} | ${date}`,
  }
}

function hideTooltip() {
  tooltip.value = null
}
</script>

<template>
  <div
    ref="containerRef"
    class="eac-container"
    @vue:mounted="updateWidth"
  >
    <div v-if="history.length < 2" class="eac-empty">
      {{ t('world.emotionalArcEmpty') }}
    </div>
    <div v-else class="eac-chart-wrapper">
      <!-- Legend -->
      <div class="eac-legend">
        <span class="eac-legend-item">
          <span class="eac-legend-line eac-legend-line--affinity" />
          {{ t('world.affinity') }}
        </span>
        <span class="eac-legend-item">
          <span class="eac-legend-line eac-legend-line--trust" />
          {{ t('world.trust') }}
        </span>
      </div>

      <svg
        :width="containerWidth"
        :height="CHART_HEIGHT"
        class="eac-svg"
      >
        <g :transform="`translate(${PADDING.left},${PADDING.top})`">
          <!-- Grid lines -->
          <line
            v-for="yl in yLabels"
            :key="yl.value"
            :x1="0"
            :y1="yAffinity(yl.value)"
            :x2="innerWidth"
            :y2="yAffinity(yl.value)"
            class="eac-grid"
          />

          <!-- Zero line (affinity) -->
          <line
            :x1="0"
            :y1="yAffinity(0)"
            :x2="innerWidth"
            :y2="yAffinity(0)"
            class="eac-zero-line"
          />

          <!-- Affinity path -->
          <path
            :d="affinityPath"
            class="eac-line eac-line--affinity"
          />

          <!-- Trust path -->
          <path
            :d="trustPath"
            class="eac-line eac-line--trust"
          />

          <!-- Mood scatter points -->
          <circle
            v-for="(pt, idx) in moodPoints"
            :key="idx"
            :cx="pt.x"
            :cy="pt.y"
            r="4"
            class="eac-dot"
            @mouseenter="showTooltip(pt, $event)"
            @mouseleave="hideTooltip"
          >
            <title>{{ pt.emoji }} {{ pt.mood }}</title>
          </circle>

          <!-- Y-axis labels -->
          <text
            v-for="yl in yLabels"
            :key="`label-${yl.value}`"
            :x="-6"
            :y="yAffinity(yl.value)"
            class="eac-axis-label"
            text-anchor="end"
            dominant-baseline="middle"
          >
            {{ yl.label }}
          </text>

          <!-- X-axis labels -->
          <text
            v-for="(xl, idx) in xLabels"
            :key="`x-${idx}`"
            :x="xl.x"
            :y="INNER_HEIGHT + 18"
            class="eac-axis-label"
            text-anchor="middle"
          >
            {{ xl.label }}
          </text>
        </g>
      </svg>

      <!-- Tooltip overlay -->
      <div
        v-if="tooltip"
        class="eac-tooltip"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
      >
        {{ tooltip.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.eac-container {
  position: relative;
  width: 100%;
}

.eac-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 14px;
}

.eac-chart-wrapper {
  position: relative;
}

.eac-legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.eac-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.eac-legend-line {
  display: inline-block;
  width: 16px;
  height: 2px;
  border-radius: 1px;
}

.eac-legend-line--affinity {
  background: #4a90d9;
}

.eac-legend-line--trust {
  background: #4caf50;
}

.eac-svg {
  display: block;
}

.eac-grid {
  stroke: var(--ion-color-light-shade, #e0e0e0);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.eac-zero-line {
  stroke: var(--ion-color-medium, #999);
  stroke-width: 1;
  stroke-dasharray: 2 2;
  opacity: 0.5;
}

.eac-line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.eac-line--affinity {
  stroke: #4a90d9;
}

.eac-line--trust {
  stroke: #4caf50;
}

.eac-dot {
  fill: #4a90d9;
  opacity: 0.7;
  cursor: pointer;
  transition: opacity 0.15s;
}

.eac-dot:hover {
  opacity: 1;
  r: 6;
}

.eac-axis-label {
  font-size: 10px;
  fill: var(--ion-color-medium, #999);
}

.eac-tooltip {
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
