<script setup lang="ts">
import { computed } from 'vue'
import { useAiMode } from '../../../composables/ai-mode'
import { useHomeCopy } from '../../../composables/home'
import { usePlayer } from '../../../composables/player'
import { aiCopy } from './copy'

/** Stops shown on the route map besides the departure. */
const RECENT = 4

const ai = useAiMode()!
const t = aiCopy[ai.locale]
const home = useHomeCopy()
const { chapterId, state, variables } = usePlayer()

const run = computed(() => ai.run.value)
const status = computed(() => run.value?.status.value)
const writing = computed(() => run.value?.writing.value)
const here = computed(() => run.value?.stationOf(chapterId.value) ?? 'start')

const route = computed(() => {
  const all = run.value?.stations.value ?? [{ id: 'start' }]
  const recent = all.slice(1).slice(-RECENT)
  const shown = [all[0], ...recent].map(station => ({
    id: station.id,
    name: station.name ?? home.value.script.depart,
    pending: false,
  }))
  if (writing.value)
    shown.push({ id: 'pending', name: writing.value.title ?? '…', pending: true })
  const at = shown.findIndex(station => station.id === here.value)
  const step = shown.length > 1 ? 84 / (shown.length - 1) : 0
  return {
    skipped: all.length - 1 - recent.length,
    stops: shown.map((station, i) => ({ ...station, x: 8 + i * step, here: i === at && !writing.value, passed: i < at || (!!writing.value && !station.pending) })),
  }
})

const lineEnd = computed(() => route.value.stops.filter(stop => !stop.pending).at(-1)?.x ?? 8)
const pendingX = computed(() => route.value.stops.find(stop => stop.pending)?.x)

const fallbackHere = computed(() => run.value?.segments.value.find(segment => segment.chapterId === here.value)?.fallback)
const sampleEnded = computed(() => status.value === 'sample' && state.value.status === 'ended')
const memories = computed(() => (Array.isArray(variables.value.memories) ? variables.value.memories : []).filter((item): item is string => typeof item === 'string'))
const passedStops = computed(() => (run.value?.stations.value ?? []).slice(1))
const tokens = computed(() => {
  const usage = run.value?.usage.value
  return usage && { total: usage.promptTokens + usage.completionTokens, estimated: usage.estimated }
})

function openSettings() {
  ai.settingsOpen.value = true
}
</script>

<template>
  <div class="ai-layer">
    <div class="route-map" aria-hidden="true">
      <svg class="route-line" viewBox="0 0 100 56" preserveAspectRatio="none">
        <path :d="`M8 26 H${lineEnd}`" vector-effect="non-scaling-stroke" />
        <path v-if="pendingX" class="is-pending" :d="`M${lineEnd} 26 H${pendingX}`" vector-effect="non-scaling-stroke" />
      </svg>
      <template v-for="(stop, i) in route.stops" :key="stop.id">
        <i
          class="stop"
          :class="{ 'is-passed': stop.passed, 'is-here': stop.here, 'is-pending': stop.pending }"
          :style="{ left: `${stop.x}%` }"
        />
        <span
          class="stop-name"
          :class="{ 'is-here': stop.here, 'is-pending': stop.pending, 'is-first': i === 0, 'is-last': i > 0 && i === route.stops.length - 1 }"
          :style="{ left: `${stop.x}%`, maxWidth: `${Math.max(12, 84 / route.stops.length)}%` }"
        >{{ stop.name }}</span>
        <span v-if="i === 0 && route.skipped > 0" class="skipped" :style="{ left: `${(stop.x + route.stops[1].x) / 2}%` }">···</span>
      </template>
    </div>

    <button
      v-if="status === 'playing' || status === 'writing' || status === 'error'"
      type="button"
      class="h-chip get-off"
      @click="run?.finish()"
    >
      {{ t.getOff }}
    </button>
    <span v-else-if="status === 'sample'" class="h-chip sample-note">{{ t.sample.note }}</span>

    <div class="window-slot" aria-live="polite">
      <div v-if="writing" class="h-led-board board">
        <span class="board-label">{{ t.nextStop }}</span>
        <span class="board-title h-led-dots">{{ writing.title ?? '' }}<i class="caret" /></span>
        <span class="board-status">{{ writing.attempt > 1 ? t.repairing : t.writing }}</span>
      </div>
      <div v-else-if="status === 'starting' || (ai.settingsOpen.value && !run?.story.value)" class="h-led-board board">
        <span class="board-status">{{ ai.settingsOpen.value ? t.waiting : t.starting }}</span>
      </div>
      <div v-else-if="status === 'error'" class="h-led-board board is-error" role="alert">
        <span class="board-status">{{ t.errors[run!.error.value?.type ?? 'internal'] }}</span>
        <span class="board-actions">
          <button type="button" class="h-chip" @click="run?.retry()">{{ t.retry }}</button>
          <button type="button" class="h-chip" @click="openSettings">{{ t.settings }}</button>
          <button type="button" class="h-chip" @click="ai.leave()">{{ t.exit }}</button>
        </span>
      </div>
      <div v-else-if="sampleEnded" class="h-led-board board">
        <span class="board-status">{{ t.sample.end }}</span>
        <span class="board-actions">
          <button type="button" class="h-chip" @click="openSettings">{{ t.sample.key }}</button>
          <button type="button" class="h-chip" @click="ai.leave()">{{ t.exit }}</button>
        </span>
      </div>
      <p v-else-if="fallbackHere" class="fallback">
        {{ t.fallback }}
      </p>
    </div>

    <div v-if="status === 'finished'" class="ticket-slot">
      <article class="ticket" aria-labelledby="ai-ticket-title">
        <header class="ticket-head">
          <h3 id="ai-ticket-title" class="ticket-title">
            {{ t.ticket.title }}
          </h3>
          <span class="ticket-sub">{{ t.ticket.sub }}</span>
        </header>
        <p class="ticket-route">
          {{ t.ticket.route(passedStops.length) }}
        </p>
        <ol v-if="passedStops.length" class="ticket-stops">
          <li v-for="stop in passedStops" :key="stop.id">
            {{ stop.name }}
          </li>
        </ol>
        <template v-if="memories.length">
          <p class="ticket-label">
            {{ t.ticket.memories }}
          </p>
          <ul class="ticket-memories">
            <li v-for="memory in memories" :key="memory">
              {{ memory }}
            </li>
          </ul>
        </template>
        <p v-if="tokens" class="ticket-usage">
          {{ t.ticket.usage(tokens.total, tokens.estimated) }}
        </p>
        <footer class="ticket-actions">
          <button type="button" class="h-sign" @click="ai.begin()">
            <span class="h-sign-text"><span class="h-sign-label">{{ t.ticket.again }}</span></span>
          </button>
          <button type="button" class="h-chip" @click="ai.leave()">
            {{ t.ticket.back }}
          </button>
        </footer>
      </article>
    </div>
  </div>
</template>

<style scoped>
.ai-layer {
  position: absolute;
  inset: 0;
  /* Above the stage's own chips, so the ticket covers them. */
  z-index: 4;
  pointer-events: none;
}

.ai-layer :is(button, .ticket-slot) {
  pointer-events: auto;
}

/* The line runs on: departure, the newest stops, and the one being written */
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

.route-line path.is-pending {
  stroke-dasharray: 2 8;
  animation: dash 0.8s linear infinite;
}

.stop {
  position: absolute;
  top: 26px;
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

.stop.is-pending {
  border-style: dashed;
}

.stop-name {
  position: absolute;
  top: 35px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  transform: translateX(-50%);
}

/* The ends hang inward so their names stay on the map. */
.stop-name.is-first {
  transform: translateX(-12%);
}

.stop-name.is-last {
  transform: translateX(-88%);
}

.stop-name.is-here {
  font-weight: 700;
}

.stop-name.is-pending {
  color: #6b6f6d;
}

.skipped {
  position: absolute;
  top: 14px;
  font-size: 11px;
  letter-spacing: 0.1em;
  transform: translateX(-50%);
}

.get-off,
.sample-note {
  position: absolute;
  top: 100px;
  left: 24px;
}

.sample-note {
  cursor: default;
  pointer-events: none;
}

/* Boards sit in the car window */
.window-slot {
  position: absolute;
  top: 88px;
  left: 12px;
  right: 12px;
  bottom: 34%;
  display: grid;
  place-items: center;
  padding: 44px 16px 12px;
}

.board {
  display: grid;
  gap: 8px;
  justify-items: center;
  max-width: min(100%, 420px);
  padding: 14px 22px;
  text-align: center;
  pointer-events: auto;
}

.board-label {
  font-size: 12px;
  letter-spacing: 0.2em;
  opacity: 0.8;
}

.board-title {
  min-height: 1.3em;
  font-family: var(--h-story);
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 900;
  line-height: 1.3;
  letter-spacing: 0.08em;
}

.caret {
  display: inline-block;
  width: 0.5em;
  height: 0.9em;
  margin-left: 0.15em;
  vertical-align: -0.05em;
  background: currentColor;
  animation: blink 1s steps(1) infinite;
}

.board-status {
  font-size: 14px;
  line-height: 1.6;
}

.board.is-error .board-status {
  color: #ffd6a1;
}

.board-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.fallback {
  align-self: end;
  margin: 0;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--h-mist);
  background: rgba(6, 13, 34, 0.6);
}

/* Ticket: the ride, stamped */
.ticket-slot {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(8, 12, 10, 0.72);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.ticket {
  display: grid;
  gap: 10px;
  box-sizing: border-box;
  width: min(100%, 360px);
  max-height: 100%;
  overflow: auto;
  padding: 18px 20px;
  border-radius: 12px;
  color: #1c1f1e;
  background: #f1ede2;
  box-shadow: 0 24px 48px -20px rgba(0, 0, 0, 0.8);
}

.ticket-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(28, 31, 30, 0.4);
}

.ticket-title {
  margin: 0;
  font-family: var(--h-story);
  font-size: 20px;
  font-weight: 900;
}

.ticket-sub,
.ticket-label,
.ticket-usage {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #5d615f;
}

.ticket-route {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.ticket-stops,
.ticket-memories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}

.ticket-stops li:not(:last-child)::after {
  content: ' →';
  color: #8a8f8c;
}

.ticket-memories li {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(30, 107, 80, 0.12);
}

.ticket-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding-top: 4px;
}

.ticket-actions .h-sign {
  min-height: 44px;
}

.ticket-actions .h-chip {
  color: #1c1f1e;
  border-color: rgba(28, 31, 30, 0.3);
  background: transparent;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@keyframes dash {
  to {
    stroke-dashoffset: -10;
  }
}

@media (prefers-reduced-motion: reduce) {
  .route-line path.is-pending,
  .caret {
    animation: none;
  }

  .stop {
    transition: none;
  }
}
</style>
