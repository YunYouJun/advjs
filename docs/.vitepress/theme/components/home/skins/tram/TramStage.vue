<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { preloadAi, useAiMode } from '../../../../composables/ai-mode'
import { useHomeCopy } from '../../../../composables/home'
import { usePlayer } from '../../../../composables/player'
import { stationOf, stations } from '../../data/last-tram'
import HomeCity from '../../HomeCity.vue'
import HomeTypewriter from '../../HomeTypewriter.vue'

defineProps<{ still?: boolean }>()

// AI mode draws its own route map and boards; it loads with the rest of the AI chunk.
const TramAiLayer = defineAsyncComponent(() => import('../../ai/TramAiLayer.vue'))

const t = useHomeCopy()
const { current, currentId, currentKey, choices, said, typed, instant, auto, trail, next, choose } = usePlayer()
const ai = useAiMode()
const aiOn = computed(() => !!ai?.on.value)

function toggleAi() {
  if (ai?.on.value)
    ai.leave()
  else
    ai?.enter()
}

// The route map: anchors laid out as a tram line that forks after 钟楼.
const STOPS: Record<string, { x: number, y: number }> = {
  start: { x: 8, y: 26 },
  bookshop: { x: 32, y: 26 },
  clock: { x: 56, y: 26 },
  sea: { x: 82, y: 13 },
  observatory: { x: 82, y: 41 },
}

const route = computed(() => stations.map(st => ({
  ...st,
  ...STOPS[st.id],
  name: st.name ?? t.value.script.depart,
  here: stationOf[currentKey.value] === st.id,
  passed: trail.value.includes(st.id),
})))

/** 小云 boards with her first line in a scene and gets off at the next scene. */
const cast = ref(false)
watch([current, said], () => {
  if (current.value?.kind === 'scene')
    cast.value = false
  else if (said.value?.speaker)
    cast.value = true
})
</script>

<template>
  <div class="screen h-car" :class="{ 'is-still': still }">
    <div v-if="!aiOn" class="route-map" aria-hidden="true">
      <svg class="route-line" viewBox="0 0 100 56" preserveAspectRatio="none">
        <path d="M8 26 H58 C 66 26, 66 13, 74 13 H82 M58 26 C 66 26, 66 41, 74 41 H82" vector-effect="non-scaling-stroke" />
      </svg>
      <template v-for="stop in route" :key="stop.id">
        <i
          class="stop"
          :class="{ 'is-passed': stop.passed, 'is-here': stop.here }"
          :style="{ left: `${stop.x}%`, top: `${stop.y}px` }"
        />
        <span
          class="stop-name"
          :class="{ 'is-branch': stop.branch, 'is-here': stop.here }"
          :style="{ left: `${stop.x}%`, top: `${stop.y}px` }"
        >{{ stop.name }}</span>
      </template>
    </div>

    <div class="car-window" aria-hidden="true">
      <HomeCity :pace="30" />
      <i class="pillar" />
    </div>

    <div class="screen-tools">
      <button
        v-if="ai"
        type="button"
        class="h-chip"
        :aria-pressed="aiOn"
        :aria-busy="ai.loading.value"
        :aria-label="t.ui.ai"
        :title="t.ui.ai"
        @pointerenter="preloadAi"
        @focus="preloadAi"
        @click="toggleAi"
      >
        AI
      </button>
      <button type="button" class="h-chip" :aria-pressed="auto" @click="auto = !auto">
        {{ t.ui.auto }}
      </button>
    </div>

    <TramAiLayer v-if="aiOn" />

    <Transition name="sprite">
      <img
        v-if="cast"
        class="sprite"
        src="/img/xiaoyun.webp"
        alt=""
        width="619"
        height="619"
        loading="lazy"
        decoding="async"
      >
    </Transition>

    <Transition name="scene">
      <div v-if="current?.kind === 'scene'" :key="currentId" class="scene-card h-led-board">
        <p class="scene-title h-led-dots">
          <span>{{ current.data!.place }}</span>
          <span>{{ current.data!.time }}</span>
          <span v-if="current.data!.inOrOut">{{ current.data!.inOrOut }}</span>
        </p>
        <span class="h-hud scene-anchor">{#{{ currentId }}}</span>
      </div>
    </Transition>

    <div v-if="choices.length" class="options">
      <button
        v-for="choice in choices"
        :key="`${currentId}-${choice.id}`"
        type="button"
        class="h-sign"
        :disabled="choice.locked"
        @click="choose(choice)"
      >
        <span class="h-sign-text">
          <span class="h-sign-label">{{ choice.label }}</span>
          <span class="h-sign-sub">{{ choice.open ? t.ui.nextStop : choice.target }}</span>
        </span>
        <span class="h-sign-arrow i-ri-arrow-right-line" aria-hidden="true" />
      </button>
    </div>

    <div v-if="said" class="h-led-board box" :class="{ 'is-narration': !said.speaker }" @click="next">
      <span v-if="said.speaker" class="h-plate">{{ said.speaker }}</span>
      <HomeTypewriter
        :key="said.key"
        as="p"
        class="said"
        :text="said.text"
        :speed="40"
        :instant="instant"
        @done="typed = true"
      />
      <button
        type="button"
        class="next"
        :aria-label="typed ? t.ui.next : t.ui.reveal"
        :disabled="!!choices.length"
        @click.stop="next"
      >
        <span v-show="typed && !choices.length" class="h-next" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* One tram car */

.screen {
  --h-radius: 18px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;
  height: 100%;
  padding: 14px;
}

@media (min-width: 640px) {
  .screen {
    padding: 18px;
  }
}

/* Route map: the script's anchors as stops */
.screen.is-still {
  --drive: paused;
}

.route-map {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  height: 64px;
  border-radius: 10px;
  color: #1c1f1e;
  background: #e6ebe7;
}

.route-line {
  position: absolute;
  inset: 0 0 8px;
  width: 100%;
  height: 56px;
}

.route-line path {
  fill: none;
  stroke: var(--h-enamel);
  stroke-width: 5;
  stroke-linecap: round;
}

.stop {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  box-sizing: border-box;
  border: 3px solid var(--h-enamel);
  border-radius: 50%;
  background: #e6ebe7;
  transition:
    background-color 0.3s,
    border-color 0.3s,
    box-shadow 0.3s;
}

.stop.is-passed {
  background: var(--h-enamel);
}

.stop.is-here {
  border-color: #7a4a08;
  background: var(--h-led);
  box-shadow:
    0 0 0 4px rgba(255, 177, 59, 0.3),
    0 0 12px var(--h-led);
}

.stop-name {
  position: absolute;
  margin-top: 9px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transform: translateX(-50%);
}

.stop-name.is-branch {
  margin: -9px 0 0 12px;
  transform: none;
}

.stop-name.is-here {
  font-weight: 700;
}

/* Window: the night sliding past */
.car-window {
  position: absolute;
  top: 88px;
  left: 12px;
  right: 12px;
  bottom: 34%;
  overflow: hidden;
  border-radius: 16px;
  background: var(--h-sky);
}

/* Frame drawn above the city */
.car-window::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 8px #1a211e,
    inset 0 -30px 40px -24px rgba(0, 0, 0, 0.5);
}

.pillar {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 58%;
  width: 12px;
  background: linear-gradient(90deg, #121815, #222b27 50%, #121815);
}

.screen-tools {
  position: absolute;
  top: 100px;
  right: 24px;
  z-index: 3;
  display: flex;
  gap: 8px;
}

.sprite {
  position: absolute;
  right: 4%;
  bottom: 22%;
  z-index: 0;
  width: auto;
  height: 58%;
  max-width: 60%;
  object-fit: contain;
  filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.5));
  pointer-events: none;
}

.sprite-enter-active,
.sprite-leave-active {
  transition:
    opacity 0.5s var(--h-ease),
    transform 0.6s var(--h-ease);
}

.sprite-enter-from,
.sprite-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

/* Scene heading: shown on the destination board */
.scene-card {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 16px 26px 12px;
  transform: translate(-50%, -60%);
}

.scene-title {
  display: flex;
  gap: 0.6em;
  margin: 0;
  font-family: var(--h-story);
  font-size: clamp(24px, 3.4vw, 34px);
  font-weight: 900;
  line-height: 1.3;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.scene-anchor {
  color: rgba(255, 177, 59, 0.7);
}

.scene-enter-active,
.scene-leave-active {
  transition:
    opacity 0.5s var(--h-ease),
    transform 0.6s var(--h-ease);
}

.scene-enter-from,
.scene-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%);
}

.options {
  position: absolute;
  z-index: 1;
  top: 88px;
  left: 0;
  right: 0;
  bottom: 34%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
}

.options .h-sign {
  width: min(100%, 290px);
  animation: option-in 0.45s var(--h-ease) both;
}

.options .h-sign:nth-child(2) {
  animation-delay: 80ms;
}

.options .h-sign:hover,
.options .h-sign:focus-visible {
  transform: translateX(4px);
}

/* Dialogue: the LED board */
.box {
  z-index: 1;
  min-height: 112px;
  padding: 26px 20px 16px;
  cursor: pointer;
}

.box > .h-plate {
  position: absolute;
  top: 0;
  left: 16px;
  transform: translateY(-50%);
}

.box.is-narration .said {
  color: #d9c39c;
}

.said {
  margin: 0;
  padding-right: 24px;
  font-family: var(--h-story);
  font-size: 17px;
  line-height: 1.85;
  letter-spacing: 0.02em;
  color: #f3dcb4;
}

@media (min-width: 640px) {
  .said {
    font-size: 18px;
  }
}

.next {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
}

.next:disabled {
  cursor: default;
}

.next .h-next {
  border-color: var(--h-led);
  filter: drop-shadow(0 0 6px var(--h-led-glow));
}

@keyframes option-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scene-enter-active,
  .scene-leave-active,
  .sprite-enter-active,
  .sprite-leave-active {
    transition: none;
  }

  .options .h-sign {
    animation: none;
  }

  .stop {
    transition: none;
  }
}
</style>
