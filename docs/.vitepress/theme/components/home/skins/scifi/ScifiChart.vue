<script setup lang="ts">
import { createRandom } from '../../../../composables/home'

/**
 * The observatory's star chart: a planet under watch, one moon on its orbit and a reticle
 * locked on a distant star. Hairlines only; orange marks what the instrument is tracking.
 * Pass `--drive: paused` from a parent to stop the orbit.
 */
withDefaults(defineProps<{ reading?: string }>(), { reading: '0.91' })

const random = createRandom(427)
const stars = Array.from({ length: 46 }, () => ({
  x: Math.round(random() * 600),
  y: Math.round(random() * 420),
  r: random() > 0.85 ? 1.6 : 0.9,
}))

const ticks = Array.from({ length: 72 }, (_, i) => {
  const a = (i * 5 * Math.PI) / 180
  const long = i % 6 === 0
  const r1 = 196
  const r2 = long ? 186 : 191
  return {
    x1: 300 + r1 * Math.cos(a),
    y1: 210 + r1 * Math.sin(a),
    x2: 300 + r2 * Math.cos(a),
    y2: 210 + r2 * Math.sin(a),
    long,
  }
})
</script>

<template>
  <svg viewBox="0 0 600 420" fill="none" class="sf-chart">
    <g class="stars">
      <circle v-for="(s, i) in stars" :key="i" :cx="s.x" :cy="s.y" :r="s.r" />
    </g>

    <g class="rings">
      <circle cx="300" cy="210" r="70" />
      <circle cx="300" cy="210" r="140" stroke-dasharray="2 6" />
      <circle cx="300" cy="210" r="196" />
      <path d="M300 4V416M94 210H506" stroke-dasharray="1 7" />
    </g>

    <g class="ticks">
      <line v-for="(tick, i) in ticks" :key="i" v-bind="{ x1: tick.x1, y1: tick.y1, x2: tick.x2, y2: tick.y2 }" :class="{ long: tick.long }" />
    </g>

    <g class="labels">
      <text x="306" y="22">000</text>
      <text x="508" y="206">090</text>
      <text x="306" y="408">180</text>
      <text x="64" y="206">270</text>
    </g>

    <!-- The ecliptic, precessing -->
    <g class="precess">
      <ellipse cx="300" cy="210" rx="190" ry="64" transform="rotate(-18 300 210)" />
    </g>

    <!-- The planet under watch and its moon -->
    <circle class="planet" cx="300" cy="210" r="11" />
    <circle class="planet-ring" cx="300" cy="210" r="18" />
    <g class="orbit">
      <circle class="moon" cx="440" cy="210" r="4" />
      <path class="moon-trail" d="M440 210 A140 140 0 0 0 421 140" />
    </g>

    <!-- Lock on a distant star -->
    <g class="lock">
      <circle class="target" cx="478" cy="96" r="3" />
      <g class="brackets">
        <path d="M464 86v-6h6M492 86v-6h-6M464 106v6h6M492 106v6h-6" />
      </g>
      <path class="leader" d="M496 96h34" />
      <text class="lock-label" x="534" y="93">LOCK</text>
      <text class="lock-value" x="534" y="105">{{ reading }}</text>
    </g>
  </svg>
</template>

<style scoped>
.sf-chart {
  display: block;
  overflow: visible;
}

.stars circle {
  fill: #e9e7e1;
  opacity: 0.55;
}

.rings circle,
.rings path,
.ticks line {
  stroke: #e9e7e1;
  stroke-opacity: 0.16;
  vector-effect: non-scaling-stroke;
}

.ticks line.long {
  stroke-opacity: 0.4;
}

.labels text,
.lock text {
  font-family: var(--h-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  fill: #8d8a83;
}

.precess {
  transform-origin: 300px 210px;
  animation: sf-spin 240s linear infinite;
  animation-play-state: var(--drive, running);
}

.precess ellipse {
  stroke: #e9e7e1;
  stroke-opacity: 0.5;
}

.planet {
  fill: #e9e7e1;
}

.planet-ring {
  stroke: #e9e7e1;
  stroke-opacity: 0.35;
}

.orbit {
  transform-origin: 300px 210px;
  animation: sf-spin 48s linear infinite reverse;
  animation-play-state: var(--drive, running);
}

.moon {
  fill: #ff5a1f;
}

.moon-trail {
  stroke: #ff5a1f;
  stroke-opacity: 0.5;
}

.target {
  fill: #ff5a1f;
}

.brackets {
  transform-origin: 478px 96px;
  animation: sf-lock 0.9s steps(5) both 0.6s;
}

.brackets path,
.leader {
  stroke: #ff5a1f;
  stroke-width: 1.4;
}

.lock .lock-label {
  fill: #ff5a1f;
}

@keyframes sf-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes sf-lock {
  from {
    opacity: 0;
    transform: scale(2.2);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .precess,
  .orbit,
  .brackets {
    animation: none;
  }
}
</style>
