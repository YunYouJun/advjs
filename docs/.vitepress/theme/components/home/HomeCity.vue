<script setup lang="ts">
import { createRandom } from '../../composables/home'

/**
 * The city sliding past the tram windows. Fill a positioned box with it.
 * Each skyline is one seamless 1200-wide tile: buildings that run past the right edge
 * are drawn again at the left, so two tiles side by side scroll forever.
 */
withDefaults(defineProps<{
  /** seconds for the near skyline to pass once; the rest scale from it */
  pace?: number
}>(), {
  pace: 48,
})

// Generated from a fixed seed so SSR and hydration agree.
const rand = createRandom(20201014)
const round = (n: number) => Math.round(n * 10) / 10
const TILE = 1200

function skyline(maxHeight: number, litRatio: number) {
  const buildings: { x: number, y: number, w: number, h: number }[] = []
  const windows: { x: number, y: number, warm: boolean, o: number }[] = []
  let x = 0
  while (x < TILE) {
    const w = round(30 + rand() * 56)
    const tower = rand() < 0.12
    const h = round(Math.min(maxHeight * (0.25 + rand() * 0.75) * (tower ? 1.45 : 1), 296))
    const y = 300 - h
    const lit: typeof windows = []
    for (let wy = y + 12; wy < 290; wy += 14) {
      for (let wx = x + 8; wx < x + w - 10; wx += 12) {
        if (rand() < litRatio)
          lit.push({ x: round(wx), y: round(wy), warm: rand() < 0.7, o: round(0.35 + rand() * 0.5) })
      }
    }
    buildings.push({ x: round(x), y, w, h })
    windows.push(...lit)
    if (x + w > TILE) {
      buildings.push({ x: round(x - TILE), y, w, h })
      windows.push(...lit.map(win => ({ ...win, x: round(win.x - TILE) })))
    }
    x += w + rand() * 8
  }
  return { buildings, windows }
}

const layers = [
  { name: 'far', fill: '#1b3373', ...skyline(210, 0.05) },
  { name: 'near', fill: '#0c1838', ...skyline(120, 0.1) },
]

// Street lamps sweeping past, one copy per half of the track.
const lamps = Array.from({ length: 7 }, () => ({
  left: round(rand() * 50),
  top: `${round(54 + rand() * 18)}%`,
  size: `${Math.round(14 + rand() * 30)}px`,
  color: rand() < 0.6 ? 'rgba(255, 177, 59, 0.55)' : 'rgba(170, 205, 255, 0.45)',
})).flatMap(lamp => [lamp, { ...lamp, left: lamp.left + 50 }].map(l => ({ ...l, left: `${l.left}%` })))
</script>

<template>
  <div class="city" :style="{ '--pace': `${pace}s` }" aria-hidden="true">
    <div v-for="layer in layers" :key="layer.name" class="track" :class="layer.name">
      <svg v-for="k in 2" :key="k" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax meet">
        <rect v-for="(b, i) in layer.buildings" :key="i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :fill="layer.fill" />
        <rect
          v-for="(w, i) in layer.windows" :key="`w${i}`" class="win" :class="{ warm: w.warm }"
          :x="w.x" :y="w.y" width="5" height="7" :opacity="w.o"
        />
      </svg>
    </div>
    <div class="track lamps">
      <i v-for="(l, i) in lamps" :key="i" :style="{ left: l.left, top: l.top, width: l.size, height: l.size, background: l.color }" />
    </div>
  </div>
</template>

<style scoped>
.city {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--h-sky);
}

.track {
  position: absolute;
  left: 0;
  bottom: 0;
  display: flex;
  width: max(200%, 1600px);
  animation: drive var(--pace) linear infinite;
  animation-play-state: var(--drive, running);
}

.track > svg {
  flex: none;
  width: 50%;
  height: auto;
  aspect-ratio: 4 / 1;
}

.track.far {
  bottom: 14%;
  opacity: 0.8;
  animation-duration: calc(var(--pace) * 3);
}

.track.lamps {
  top: 0;
  height: 100%;
  mix-blend-mode: screen;
  animation-duration: calc(var(--pace) / 5);
}

.track.lamps i {
  position: absolute;
  border-radius: 50%;
  filter: blur(7px);
}

.win {
  fill: #cfe3ff;
}

.win.warm {
  fill: #ffc46b;
}

@keyframes drive {
  to {
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .track {
    animation: none;
  }
}
</style>
