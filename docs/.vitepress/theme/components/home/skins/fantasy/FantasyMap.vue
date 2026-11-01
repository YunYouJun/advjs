<script setup lang="ts">
import { useId } from 'vue'
import { createRandom } from '../../../../composables/home'

/**
 * A hand-inked chart in iron-gall ink with vermilion rubrication: coast, river, forest and
 * mountains, and a dotted route that draws itself toward the unmapped edge.
 * Pass `--drive: paused` from a parent to stop the compass and the route.
 */
const maskId = `${useId()}-route`
const ROUTE = 'M300 530 C 380 500, 460 420, 560 380 S 760 330, 860 420 S 980 600, 1030 640 S 1160 420, 1300 300'

const random = createRandom(1604)

/** Little round trees, clustered into two woods. */
const trees = [
  ...Array.from({ length: 16 }, () => ({ x: 520 + random() * 200, y: 300 + random() * 110 })),
  ...Array.from({ length: 10 }, () => ({ x: 980 + random() * 140, y: 560 + random() * 70 })),
].map(t => ({ x: Math.round(t.x), y: Math.round(t.y), r: 9 + Math.round(random() * 5) }))

/** Hatching for the sea, in short strokes along the coast. */
const waves = Array.from({ length: 22 }, (_, i) => ({ x: 80 + (i % 11) * 120 + Math.round(random() * 40), y: 790 + Math.floor(i / 11) * 44 }))
</script>

<template>
  <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="map" aria-hidden="true">
    <!-- The sea and its coast -->
    <path class="sea" d="M0 760 C 160 730, 260 780, 400 748 S 640 700, 760 728 S 1000 790, 1160 742 S 1440 690, 1600 720 V900 H0 Z" />
    <path class="ink" d="M0 760 C 160 730, 260 780, 400 748 S 640 700, 760 728 S 1000 790, 1160 742 S 1440 690, 1600 720" />
    <path class="ink thin" d="M0 774 C 160 744, 260 794, 400 762 S 640 714, 760 742 S 1000 804, 1160 756 S 1440 704, 1600 734" />
    <path v-for="(w, i) in waves" :key="i" class="ink thin" :d="`M${w.x} ${w.y} q 10 -8 20 0 t 20 0`" />

    <!-- The river, down to the sea -->
    <path class="river" d="M1080 120 C 1040 240, 1120 320, 1060 420 S 940 560, 980 650 S 900 720, 880 740" />

    <!-- Mountains -->
    <g class="ink fill-paper">
      <path d="M1180 300 l60 -110 l60 110 z" />
      <path d="M1260 310 l50 -90 l50 90 z" />
      <path d="M1340 304 l70 -130 l70 130 z" />
    </g>
    <g class="ink thin">
      <path d="M1240 190 l-18 40 M1250 210 l-14 32 M1410 174 l-20 44 M1420 196 l-16 36" />
    </g>

    <!-- Woods -->
    <g class="ink fill-paper">
      <circle v-for="(t, i) in trees" :key="i" :cx="t.x" :cy="t.y" :r="t.r" />
    </g>

    <!-- A town and a ferry -->
    <g class="ink-fill">
      <rect x="250" y="520" width="26" height="20" />
      <path d="M246 520 l17 -16 l17 16 z" />
      <rect x="290" y="528" width="20" height="14" />
      <path d="M287 528 l13 -12 l13 12 z" />
    </g>
    <path class="ink" d="M1010 640 h 40 M1012 646 h 36" />

    <!-- The route: town, through the wood, across the ferry, to the mountains.
         A solid copy in a mask uncovers the dashes from the town onward. -->
    <mask :id="maskId" maskUnits="userSpaceOnUse">
      <path class="route-reveal" :d="ROUTE" pathLength="1" />
    </mask>
    <path class="route" :d="ROUTE" :mask="`url(#${maskId})`" />
    <path class="cross" d="M1288 286 l24 24 M1312 286 l-24 24" />

    <!-- Names, in the cartographer's italic -->
    <g class="names">
      <text x="210" y="580">灯芯村</text>
      <text x="560" y="290">低语森林</text>
      <text x="1060" y="690">渡口</text>
      <text x="1250" y="150">龙脊山</text>
      <text x="620" y="840" class="sea-name">无名之海</text>
    </g>

    <!-- The unmapped edge: hatching stops, and so does the ink -->
    <path class="edge" d="M1500 0 C 1470 120, 1520 260, 1480 400 S 1510 640, 1490 760" />
    <text x="1528" y="420" class="edge-name" transform="rotate(90 1528 420)">未绘之地</text>

    <!-- Compass rose -->
    <g class="compass" transform="translate(200 200)">
      <circle r="62" class="ink thin" />
      <circle r="54" class="ink thin" stroke-dasharray="2 6" />
      <g class="needle">
        <path d="M0 -78 L10 0 L0 10 L-10 0 Z" class="rubric" />
        <path d="M0 78 L10 0 L0 -10 L-10 0 Z" class="ink-fill" />
        <path d="M-70 0 L0 8 L8 0 L0 -8 Z M70 0 L0 8 L-8 0 L0 -8 Z" class="ink-fill" opacity="0.55" />
      </g>
      <text y="-90" text-anchor="middle" class="rubric-text">北</text>
    </g>
  </svg>
</template>

<style scoped>
.map {
  display: block;
  width: 100%;
  height: 100%;
}

.ink {
  fill: none;
  stroke: #2a1f16;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ink.thin {
  stroke-width: 1.2;
}

.fill-paper {
  fill: #ece2cb;
}

.ink-fill {
  fill: #2a1f16;
}

.sea {
  fill: #dfd3b6;
}

.river {
  fill: none;
  stroke: #2a1f16;
  stroke-width: 7;
  stroke-linecap: round;
}

.route {
  fill: none;
  stroke: #a8321c;
  stroke-width: 3;
  stroke-dasharray: 10 10;
  stroke-linecap: round;
}

.route-reveal {
  fill: none;
  stroke: #fff;
  stroke-width: 16;
  stroke-dasharray: 1 1;
  animation: route-draw 6s var(--h-ease) 0.4s both;
  animation-play-state: var(--drive, running);
}

.cross {
  stroke: #a8321c;
  stroke-width: 5;
  stroke-linecap: round;
}

.names text {
  font-family: var(--h-story);
  font-size: 26px;
  font-style: italic;
  letter-spacing: 0.12em;
  fill: #2a1f16;
}

.names .sea-name {
  font-size: 30px;
  letter-spacing: 0.6em;
  fill: #6b5a47;
}

.edge {
  fill: none;
  stroke: #2a1f16;
  stroke-width: 1.4;
  stroke-dasharray: 3 9;
}

.edge-name {
  font-family: var(--h-story);
  font-size: 22px;
  font-style: italic;
  letter-spacing: 0.5em;
  fill: #6b5a47;
}

.rubric {
  fill: #a8321c;
}

.rubric-text {
  font-family: var(--h-story);
  font-size: 22px;
  fill: #a8321c;
}

.needle {
  animation: needle 8s ease-in-out infinite alternate;
  animation-play-state: var(--drive, running);
}

@keyframes route-draw {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes needle {
  from {
    transform: rotate(-6deg);
  }
  to {
    transform: rotate(5deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .route-reveal,
  .needle {
    animation: none;
  }
}
</style>
