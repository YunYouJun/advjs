<script setup lang="ts">
/**
 * Picture-book plates in flat gouache: one per `background` the story sets.
 * `room`, `wheel`, `seed` and `night` come from the script; `sleep` closes the book.
 * Pass `--drive: paused` from a parent to stop the wheel.
 */
withDefaults(defineProps<{ scene?: string }>(), { scene: 'room' })
</script>

<template>
  <svg viewBox="0 0 520 300" class="art" :class="`is-${scene}`" aria-hidden="true">
    <!-- Window: summer sky by day, stars at night -->
    <g v-if="scene !== 'wheel'" class="window far">
      <rect x="40" y="26" width="150" height="120" rx="8" :fill="scene === 'night' ? '#3d4f78' : '#bfe0d8'" />
      <path d="M115 26v120M40 86h150" stroke="#fbf6ea" stroke-width="7" />
      <template v-if="scene === 'night'">
        <path d="M156 50a13 13 0 1 0 10 22a11 11 0 1 1 -10 -22z" fill="#fbe6a6" />
        <g fill="#fbe6a6">
          <circle cx="62" cy="48" r="2" /><circle cx="90" cy="66" r="1.6" /><circle cx="70" cy="112" r="2.2" /><circle cx="142" cy="118" r="1.6" /><circle cx="170" cy="104" r="2" />
        </g>
      </template>
      <circle v-else cx="160" cy="54" r="14" fill="#f7d36b" />
      <rect x="32" y="146" width="166" height="10" rx="5" fill="#e8d8b8" />
    </g>

    <!-- The floor of the room -->
    <ellipse cx="300" cy="276" rx="230" ry="14" fill="#efe2c4" />

    <!-- The cage -->
    <g v-if="scene === 'room' || scene === 'night'" class="cage mid">
      <path d="M250 270 V120 Q 330 70 410 120 V270" fill="none" stroke="#7fb3a6" stroke-width="5" stroke-linejoin="round" />
      <path d="M270 270V106M290 270V96M310 270V91M330 270V90M350 270V91M370 270V96M390 270V106" stroke="#7fb3a6" stroke-width="2.5" />
      <rect x="244" y="262" width="172" height="12" rx="6" fill="#7fb3a6" />
    </g>

    <!-- The wheel -->
    <g v-if="scene === 'wheel'" class="wheel-set mid">
      <path d="M300 150 L262 274 M300 150 L338 274" stroke="#7fb3a6" stroke-width="8" stroke-linecap="round" />
      <g class="wheel">
        <circle cx="300" cy="150" r="104" fill="none" stroke="#7fb3a6" stroke-width="9" />
        <g stroke="#7fb3a6" stroke-width="3.5">
          <path d="M300 46V254M196 150H404M226 76l148 148M374 76L226 224" />
        </g>
        <circle cx="300" cy="150" r="10" fill="#7fb3a6" />
      </g>
      <g class="motion" stroke="#e86a4f" stroke-width="3" stroke-linecap="round">
        <path d="M196 236q-14 2-26-2M204 222q-14 0-24-6" />
      </g>
    </g>

    <!-- The hamster, nearest of all -->
    <g class="near">
      <g v-if="scene === 'wheel'" class="hamster run" transform="translate(300 222)">
        <ellipse rx="44" ry="28" fill="#f2b45a" />
        <ellipse cx="8" cy="8" rx="26" ry="14" fill="#fde7c2" />
        <circle cx="-26" cy="-22" r="10" fill="#f2b45a" /><circle cx="-26" cy="-22" r="5" fill="#e86a4f" />
        <circle cx="-30" cy="-4" r="3.2" fill="#3c2f22" /><circle cx="-29" cy="-5.2" r="1" fill="#fff" />
        <circle cx="-43" cy="4" r="2.6" fill="#e86a4f" />
        <g class="legs" stroke="#e86a4f" stroke-width="4" stroke-linecap="round">
          <path d="M-20 26l-6 8M18 26l6 8" />
        </g>
      </g>

      <g v-else-if="scene === 'seed'" class="hamster sit" transform="translate(300 200)">
        <ellipse rx="56" ry="66" fill="#f2b45a" />
        <ellipse cy="18" rx="38" ry="44" fill="#fde7c2" />
        <circle cx="-34" cy="-56" r="14" fill="#f2b45a" /><circle cx="-34" cy="-56" r="7" fill="#e86a4f" />
        <circle cx="34" cy="-56" r="14" fill="#f2b45a" /><circle cx="34" cy="-56" r="7" fill="#e86a4f" />
        <!-- cheeks, full -->
        <circle cx="-30" cy="-12" r="20" fill="#f6c27a" /><circle cx="30" cy="-12" r="20" fill="#f6c27a" />
        <circle cx="-16" cy="-26" r="4" fill="#3c2f22" /><circle cx="16" cy="-26" r="4" fill="#3c2f22" />
        <circle cx="-15" cy="-27.5" r="1.3" fill="#fff" /><circle cx="17" cy="-27.5" r="1.3" fill="#fff" />
        <path d="M-4 -14q4 4 8 0" fill="#e86a4f" />
        <!-- the seed, held up in both paws -->
        <path class="seed" d="M0 2c10 0 16 14 0 34c-16 -20 -10 -34 0 -34z" fill="#3c2f22" />
        <path d="M0 6v26M-5 10l3 18M5 10l-3 18" stroke="#fbf6ea" stroke-width="1.6" />
        <ellipse cx="-14" cy="26" rx="8" ry="6" fill="#e86a4f" /><ellipse cx="14" cy="26" rx="8" ry="6" fill="#e86a4f" />
      </g>

      <g v-else-if="scene === 'night' || scene === 'room'" class="hamster look" transform="translate(330 226)">
        <ellipse rx="40" ry="38" fill="#f2b45a" />
        <ellipse cx="2" cy="10" rx="24" ry="22" fill="#fde7c2" />
        <circle cx="-24" cy="-34" r="10" fill="#f2b45a" /><circle cx="-24" cy="-34" r="5" fill="#e86a4f" />
        <circle cx="20" cy="-36" r="10" fill="#f2b45a" /><circle cx="20" cy="-36" r="5" fill="#e86a4f" />
        <circle cx="-12" cy="-18" r="4" fill="#3c2f22" /><circle cx="10" cy="-19" r="4" fill="#3c2f22" />
        <circle class="glint" cx="-13" cy="-20" r="1.5" fill="#fff" /><circle class="glint" cx="9" cy="-21" r="1.5" fill="#fff" />
        <path d="M-4 -8q3 3 6 0" fill="#e86a4f" />
      </g>

      <g v-else class="hamster sleep" transform="translate(330 246)">
        <path d="M-52 24c0-40 30-58 56-58s48 22 48 50c0 8-2 8-8 8h-90c-6 0-6 0-6 0z" fill="#f2b45a" />
        <path d="M-30 24c4-20 18-28 34-28s30 10 32 28z" fill="#fde7c2" />
        <circle cx="30" cy="-20" r="10" fill="#f2b45a" /><circle cx="30" cy="-20" r="5" fill="#e86a4f" />
        <path d="M22 0q6 5 12 0" stroke="#3c2f22" stroke-width="2.6" fill="none" stroke-linecap="round" />
        <g class="zz" fill="#7fb3a6" font-family="var(--h-story)" font-weight="700">
          <text x="56" y="-36" font-size="18">z</text>
          <text x="70" y="-56" font-size="13">z</text>
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.art {
  display: block;
  width: 100%;
  height: 100%;
}

/* Depth (see useParallax): window, then cage or wheel, then the hamster */
.far {
  translate: calc(var(--px, 0) * -4px) calc(var(--py, 0) * -3px);
}

.mid {
  translate: calc(var(--px, 0) * -1px) 0;
}

.near {
  translate: calc(var(--px, 0) * 8px) calc(var(--py, 0) * 3px);
}

.wheel {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: wheel 2.4s linear infinite;
  animation-play-state: var(--drive, running);
}

.run {
  animation: run 0.36s ease-in-out infinite alternate;
  animation-play-state: var(--drive, running);
}

.run .legs {
  transform-box: fill-box;
  transform-origin: 50% 0;
  animation: legs 0.18s linear infinite alternate;
  animation-play-state: var(--drive, running);
}

.motion {
  animation: motion 0.5s steps(2) infinite;
  animation-play-state: var(--drive, running);
}

.seed {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: nibble 0.8s ease-in-out infinite alternate;
  animation-play-state: var(--drive, running);
}

.glint {
  animation: glint 2.6s ease-in-out infinite;
  animation-play-state: var(--drive, running);
}

.zz {
  animation: zz 3s ease-in-out infinite;
  animation-play-state: var(--drive, running);
}

@keyframes wheel {
  to {
    transform: rotate(-360deg);
  }
}

@keyframes run {
  from {
    translate: 0 0;
  }
  to {
    translate: 0 -5px;
  }
}

@keyframes legs {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(-1);
  }
}

@keyframes motion {
  50% {
    opacity: 0;
  }
}

@keyframes nibble {
  to {
    transform: rotate(-6deg) translateY(-2px);
  }
}

@keyframes glint {
  50% {
    opacity: 0.2;
  }
}

@keyframes zz {
  0%,
  100% {
    opacity: 0.3;
    translate: 0 4px;
  }
  50% {
    opacity: 1;
    translate: 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wheel,
  .run,
  .run .legs,
  .motion,
  .seed,
  .glint,
  .zz {
    animation: none;
  }
}
</style>
