<script setup lang="ts">
import { useId } from 'vue'
import { createRandom } from '../../../../composables/home'

/**
 * The school library after class, in flat cut-paper colour: a west window with the sun going
 * down, light falling across the floor, a shelf of books and 林夏 by the shelf, lit from the window.
 * `cast` hides her. Pass `--drive: paused` from a parent to still the curtain and the dust.
 */
withDefaults(defineProps<{ cast?: boolean }>(), { cast: true })

const clipId = `${useId()}-window`

const SPINES = ['#3b4a6b', '#d94f6a', '#e8b04a', '#7a9e8e', '#c9705a', '#f3e7d6', '#5d4a6e']
const random = createRandom(704)

/** Four shelves of books, packed left to right, a few leaning. */
const books = Array.from({ length: 4 }).flatMap((_, shelf) => {
  const out: { x: number, y: number, w: number, h: number, fill: string, lean: number }[] = []
  const floor = 210 + shelf * 150
  let x = 1196
  while (x < 1590) {
    const w = 16 + Math.round(random() * 20)
    const h = 84 + Math.round(random() * 44)
    const lean = random() > 0.9 ? 8 : 0
    out.push({ x, y: floor - h, w, h, fill: SPINES[Math.floor(random() * SPINES.length)], lean })
    x += w + (lean ? 14 : 2)
  }
  return out
})

const motes = Array.from({ length: 14 }, (_, i) => ({
  x: 300 + Math.round(random() * 600),
  y: 420 + Math.round(random() * 320),
  r: 1.5 + random() * 2,
  delay: -i * 1.7,
}))
</script>

<template>
  <svg class="room" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <clipPath :id="clipId">
        <rect x="140" y="100" width="660" height="520" />
      </clipPath>
    </defs>

    <!-- Wall and floor -->
    <rect width="1600" height="900" fill="#f3dfca" />
    <rect y="660" width="1600" height="240" fill="#e6c6a8" />
    <rect y="760" width="1600" height="140" fill="#c4936d" />

    <!-- Evening outside: flat bands of sky, the sun, the town -->
    <g :clip-path="`url(#${clipId})`" class="far">
      <rect x="140" y="100" width="660" height="180" fill="#fde3b8" />
      <rect x="140" y="280" width="660" height="140" fill="#f9c895" />
      <rect x="140" y="420" width="660" height="110" fill="#f5ae80" />
      <rect x="140" y="530" width="660" height="90" fill="#ec9673" />
      <circle cx="560" cy="500" r="74" fill="#fff4dc" />
      <path d="M140 620V548h50v-26h40v18h34v-44h46v52h28v-30h60v40h30v-62h52v46h40v-20h44v32h36v-54h46v40h40v-16h54v76z" fill="#d7826b" />
    </g>
    <!-- Window frame -->
    <path d="M128 88h684v544H128z M140 100v520h660V100z" fill="#fff8ee" fill-rule="evenodd" />
    <rect x="463" y="100" width="14" height="520" fill="#fff8ee" />
    <rect x="140" y="353" width="660" height="14" fill="#fff8ee" />
    <rect x="112" y="628" width="716" height="18" rx="3" fill="#fff8ee" />

    <!-- Light across the floor -->
    <g class="shafts">
      <path d="M140 646 L800 646 L1040 900 L300 900 Z" fill="#ffe9c6" opacity="0.55" />
      <path d="M480 300 L800 300 L1180 640 L860 640 Z" fill="#ffeacb" opacity="0.28" />
    </g>

    <!-- Curtain, tied back -->
    <g class="curtain">
      <path d="M806 70 C 850 70, 872 72, 880 76 C 862 240, 892 420, 868 560 C 860 610, 840 640, 812 660 C 820 520, 790 300, 806 70 Z" fill="#fffaf2" />
      <path d="M832 90 C 826 260, 846 420, 834 600 M856 92 C 850 240, 870 420, 852 580" stroke="#efdcc6" stroke-width="4" fill="none" />
    </g>
    <rect x="96" y="62" width="820" height="12" rx="6" fill="#a8714f" />

    <!-- Shelf -->
    <g class="mid">
      <rect x="1180" y="40" width="440" height="740" fill="#a8714f" />
      <rect x="1192" y="52" width="420" height="716" fill="#8e5c3f" />
      <rect v-for="n in 4" :key="n" x="1180" :y="200 + (n - 1) * 150" width="440" height="14" fill="#a8714f" />
      <rect
        v-for="(book, i) in books"
        :key="i"
        :x="book.x"
        :y="book.y"
        :width="book.w"
        :height="book.h"
        :fill="book.fill"
        :transform="book.lean ? `rotate(${book.lean} ${book.x} ${book.y + book.h})` : undefined"
      />
    </g>

    <!-- Dust in the light -->
    <g class="motes near">
      <circle v-for="(m, i) in motes" :key="i" :cx="m.x" :cy="m.y" :r="m.r" :style="{ animationDelay: `${m.delay}s` }" />
    </g>

    <!-- 林夏 by the shelf, a rim of window light on her hair -->
    <g v-if="cast" class="near">
      <g class="cast">
        <g transform="translate(860 330) scale(2.9)">
          <g fill="#ffd9b0" transform="translate(-1.4 0)">
            <path d="M28 76c0-30 14-48 32-48s32 18 32 48c0 26-4 52-8 62H36c-4-10-8-36-8-62z" />
            <path d="M14 200c4-48 20-72 46-76 26 4 42 28 46 76z" />
          </g>
          <path d="M14 200c4-48 20-72 46-76 26 4 42 28 46 76z" fill="#3b4a6b" />
          <path d="M40 128l20 30 20-30-6-4-14 18-14-18z" fill="#f6efe6" />
          <path d="M55 146l5 16 5-16-5-4z" fill="#d94f6a" />
          <path d="M28 76c0-30 14-48 32-48s32 18 32 48c0 26-4 52-8 62H36c-4-10-8-36-8-62z" fill="#3b2f45" />
          <rect x="53" y="102" width="14" height="22" rx="5" fill="#f2cfb8" />
          <ellipse cx="60" cy="80" rx="21" ry="24" fill="#f6dcc8" />
          <path d="M37 72c5-20 17-28 23-28s19 8 25 28c-6-6-12-9-16-10l-3 6-4-7c-4 1-8 2-11 4l-2 6-3-5c-4 2-7 4-9 6z" fill="#3b2f45" />
          <g class="eyes">
            <ellipse cx="51" cy="84" rx="2.6" ry="3.4" fill="#3b2f45" />
            <ellipse cx="69" cy="84" rx="2.6" ry="3.4" fill="#3b2f45" />
          </g>
          <ellipse cx="46" cy="92" rx="4" ry="2" fill="#f2a7a7" opacity="0.7" />
          <ellipse cx="74" cy="92" rx="4" ry="2" fill="#f2a7a7" opacity="0.7" />
          <path d="M56 97q4 3 8 0" stroke="#a35a4f" stroke-width="1.4" fill="none" stroke-linecap="round" />
          <path d="M84 50l12-8-2 12 10 4-12 4" fill="#d94f6a" />
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.room {
  display: block;
  width: 100%;
  height: 100%;
}

/* Depth (see useParallax): the town outside, the shelf, then 林夏 and the dust nearest */
.far {
  translate: calc(var(--px, 0) * -4px) calc(var(--py, 0) * -2px);
}

.mid {
  translate: calc(var(--px, 0) * 5px) calc(var(--py, 0) * 2px);
}

.near {
  translate: calc(var(--px, 0) * 14px) calc(var(--py, 0) * 5px);
}

.shafts {
  animation: romance-light 9s ease-in-out infinite alternate;
  animation-play-state: var(--drive, running);
}

.curtain {
  transform-box: fill-box;
  transform-origin: 50% 0;
  animation: romance-sway 7s ease-in-out infinite alternate;
  animation-play-state: var(--drive, running);
}

.motes circle {
  fill: #fff6e4;
  animation: romance-mote 24s linear infinite;
  animation-play-state: var(--drive, running);
}

.eyes {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: romance-blink 5.5s infinite;
  animation-play-state: var(--drive, running);
}

.cast {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: romance-breathe 5s ease-in-out infinite alternate;
  animation-play-state: var(--drive, running);
}

@keyframes romance-light {
  to {
    opacity: 0.75;
  }
}

@keyframes romance-sway {
  from {
    transform: rotate(-0.8deg);
  }
  to {
    transform: rotate(1.2deg);
  }
}

@keyframes romance-mote {
  0% {
    opacity: 0;
    transform: translate(0, 0);
  }
  20%,
  80% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: translate(120px, -90px);
  }
}

@keyframes romance-blink {
  0%,
  94%,
  100% {
    transform: scaleY(1);
  }
  97% {
    transform: scaleY(0.1);
  }
}

@keyframes romance-breathe {
  to {
    transform: scaleY(1.008);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shafts,
  .curtain,
  .motes circle,
  .eyes,
  .cast {
    animation: none;
  }
}
</style>
