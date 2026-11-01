<script setup lang="ts">
import type { RuntimeSnapshot } from '@advjs/types'
import { computed, markRaw, nextTick, ref, shallowRef } from 'vue'
import { useHomeCopy } from '../../../../composables/home'
import { usePlayer } from '../../../../composables/player'
import HomeTypewriter from '../../HomeTypewriter.vue'

defineProps<{ still?: boolean }>()

const t = useHomeCopy()
const { program, findNode, current, currentId, choices, said, typed, instant, auto, variables, history, trail, next, choose, save, load } = usePlayer()

const NUMERALS = ['Ⅰ', 'Ⅱ', 'Ⅲ']

/** Where each anchor sits on the chart. The entry and the shore are the same jetty. */
const PLACES: Record<string, { x: number, y: number }> = {
  ferry: { x: 150, y: 150 },
  reeds: { x: 96, y: 236 },
  cross: { x: 452, y: 128 },
  around: { x: 548, y: 46 },
}
const placeOf = (anchor: string) => anchor === 'start' || anchor === 'shore' ? 'ferry' : anchor

const here = computed(() => placeOf(trail.value.at(-1) ?? program.value.entry.nodeId))
const route = computed(() => {
  const stops = [...new Set(['ferry', ...trail.value.map(placeOf)])].filter(id => PLACES[id])
  return stops.map(id => `${PLACES[id].x} ${PLACES[id].y}`).join(' L ')
})

const pack = computed(() => {
  const items = Array.isArray(variables.value.pack) ? variables.value.pack.map(String) : []
  return Array.from({ length: Math.max(3, items.length) }, (_, i) => items[i])
})

/** The anchor's own name, for labelling a save. */
function placeName() {
  const anchor = trail.value.at(-1) ?? program.value.entry.nodeId
  const node = findNode(anchor)
  return String(node?.kind === 'anchor' ? node.data!.text : node?.data?.place ?? anchor)
}

// Wax seals: three save slots holding real runtime snapshots, kept for this visit only.
// Snapshots stay raw: the runtime structured-clones them, which a reactive proxy can't survive.
const slots = shallowRef<({ snapshot: RuntimeSnapshot, at: string } | undefined)[]>([undefined, undefined, undefined])
const pressed = ref<number>()

function seal(i: number) {
  const slot = slots.value[i]
  if (slot) {
    load(slot.snapshot)
  }
  else {
    slots.value = slots.value.map((s, j) => j === i ? { snapshot: markRaw(save()), at: placeName() } : s)
    pressed.value = i
  }
}

// Journal: the backlog
const journalOpen = ref(false)
const journalButton = ref<HTMLButtonElement>()
const journalClose = ref<HTMLButtonElement>()

async function openJournal() {
  journalOpen.value = true
  await nextTick()
  journalClose.value?.focus()
}

function closeJournal() {
  journalOpen.value = false
  journalButton.value?.focus()
}
</script>

<template>
  <div class="screen ft" :class="{ 'is-still': still }" @keydown.esc="journalOpen && closeJournal()">
    <svg class="chart" viewBox="0 0 600 300" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
      <!-- The river between the jetty and the far bank -->
      <path class="river" d="M300 0 C 280 80, 340 150, 300 210 S 260 280, 280 300" />
      <path class="bank" d="M290 0 C 270 80, 330 150, 290 210 S 250 280, 270 300 M314 0 C 294 80, 354 150, 314 210 S 274 280, 294 300" />
      <!-- Reeds -->
      <path class="ink thin" d="M80 250v-20M86 252v-26M92 250v-18M98 252v-24M104 250v-16M110 252v-22" />
      <!-- The jetty -->
      <path class="ink" d="M156 150h56M160 156h48" />
      <!-- The far bank: hills -->
      <path class="ink fill" d="M420 150 l26 -40 l26 40 z M454 152 l20 -30 l20 30 z" />
      <!-- The unmapped edge -->
      <path class="edge" d="M520 0 C 506 60, 540 110, 516 170 S 530 260, 520 300" />
      <!-- The route so far -->
      <path class="route" :d="`M ${route}`" />
      <g v-for="(p, id) in PLACES" :key="id" :transform="`translate(${p.x} ${p.y})`">
        <circle class="place" :class="{ 'is-here': here === id, 'is-been': trail.map(placeOf).includes(id) }" r="5" />
      </g>
      <path class="marker" :style="{ transform: `translate(${PLACES[here]?.x ?? 150}px, ${(PLACES[here]?.y ?? 150) - 18}px)` }" d="M-7 -7 L7 7 M7 -7 L-7 7" />
      <g class="names">
        <text x="150" y="182" text-anchor="middle">渡口</text>
        <text x="96" y="276" text-anchor="middle">芦苇丛</text>
        <text x="452" y="172" text-anchor="middle">对岸</text>
        <text x="548" y="84" text-anchor="middle">地图背面</text>
      </g>
    </svg>

    <div class="margin">
      <div class="pack" :aria-label="t.script.pack" role="group">
        <span class="cap">{{ t.script.pack }}</span>
        <span class="slots">
          <span v-for="(item, i) in pack" :key="i" class="slot" :class="{ has: item }">{{ item }}</span>
        </span>
      </div>
      <div class="saves" role="group" :aria-label="t.script.saves">
        <span class="cap">{{ t.script.saves }}</span>
        <span class="seals">
          <button
            v-for="(slot, i) in slots"
            :key="i"
            type="button"
            class="seal"
            :class="{ 'is-set': slot, 'is-pressed': pressed === i }"
            :aria-label="slot ? t.script.load(i + 1, slot.at) : t.script.save(i + 1)"
            :title="slot ? t.script.load(i + 1, slot.at) : t.script.save(i + 1)"
            @click="seal(i)"
            @animationend="pressed = undefined"
          >
            {{ NUMERALS[i] }}
          </button>
        </span>
      </div>
      <div class="keys">
        <button ref="journalButton" type="button" class="ft-key" @click="openJournal">
          {{ t.script.journal }}
        </button>
        <button type="button" class="ft-key" :aria-pressed="auto" @click="auto = !auto">
          {{ t.ui.auto }}
        </button>
      </div>
    </div>

    <Transition name="ft-scene">
      <div v-if="current?.kind === 'scene'" :key="currentId" class="cartouche">
        <span class="scene-title">{{ current.data!.place }}</span>
        <span class="scene-sub">{{ current.data!.time }} · {{ current.data!.inOrOut }}</span>
      </div>
    </Transition>

    <div v-if="choices.length" class="options">
      <button
        v-for="choice in choices"
        :key="`${currentId}-${choice.id}`"
        type="button"
        class="post"
        :class="{ 'is-locked': choice.locked }"
        :disabled="choice.locked"
        @click="choose(choice)"
      >
        <span class="post-label">{{ choice.label }}</span>
        <span class="post-sub">
          <template v-if="choice.locked">{{ t.script.locked }} · when {{ choice.when }}</template>
          <template v-else-if="choice.effects.length">{{ choice.effects.join(' · ') }}</template>
          <template v-else>{{ choice.target }}</template>
        </span>
      </button>
    </div>

    <div v-if="said" class="folio" :class="{ 'is-narration': !said.speaker }" @click="next">
      <span v-if="said.speaker" class="speaker">{{ said.speaker }}</span>
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
        <span v-show="typed && !choices.length" class="quill">✒</span>
      </button>
    </div>

    <div v-if="journalOpen" class="journal" role="dialog" aria-modal="true" :aria-label="t.script.journal">
      <div class="journal-head">
        <span>{{ t.script.journal }}</span>
        <button ref="journalClose" type="button" class="ft-key" @click="closeJournal">
          {{ t.script.close }}
        </button>
      </div>
      <ol class="journal-list">
        <li v-for="line in history" :key="line.key">
          <span v-if="line.speaker" class="who">{{ line.speaker }}</span>
          <p>{{ line.text }}</p>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.ft {
  --ft-paper: #ece2cb;
  --ft-ink: #2a1f16;
  --ft-mute: #6b5a47;
  --ft-rubric: #a8321c;
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;
  height: 100%;
  padding: 14px;
  overflow: hidden;
  border-radius: 4px;
  font-family: var(--h-story);
  color: var(--ft-ink);
  background: var(--ft-paper);
  box-shadow:
    inset 0 0 0 1px rgba(42, 31, 22, 0.35),
    inset 0 0 0 5px var(--ft-paper),
    inset 0 0 0 6px rgba(42, 31, 22, 0.55);
  container-type: inline-size;
}

.screen.is-still {
  --drive: paused;
}

/* Chart */

.chart {
  position: absolute;
  z-index: -1;
  top: 64px;
  left: 0;
  width: 100%;
  height: 46%;
}

@container (min-width: 560px) {
  .chart {
    top: 20px;
    width: 76%;
    height: 56%;
  }
}

.river {
  fill: none;
  stroke: #dfd3b6;
  stroke-width: 22;
}

.bank,
.ink {
  fill: none;
  stroke: var(--ft-ink);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.ink.thin {
  stroke-width: 1;
}

.ink.fill {
  fill: var(--ft-paper);
}

.edge {
  fill: none;
  stroke: var(--ft-ink);
  stroke-width: 1;
  stroke-dasharray: 2 6;
}

.route {
  fill: none;
  stroke: var(--ft-rubric);
  stroke-width: 2;
  stroke-dasharray: 5 5;
}

.place {
  fill: var(--ft-paper);
  stroke: var(--ft-ink);
  stroke-width: 1.4;
}

.place.is-been {
  fill: var(--ft-ink);
}

.place.is-here {
  fill: var(--ft-rubric);
  stroke: var(--ft-rubric);
}

.marker {
  stroke: var(--ft-rubric);
  stroke-width: 3;
  stroke-linecap: round;
  transition: transform 0.8s var(--h-ease);
}

.names text {
  font-family: var(--h-story);
  font-size: 13px;
  font-style: italic;
  letter-spacing: 0.12em;
  fill: var(--ft-ink);
}

/* Margin: pack, seals and the journal */

.margin {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: flex-end;
  justify-content: space-between;
}

@container (min-width: 560px) {
  .margin {
    left: auto;
    flex-direction: column;
    align-items: flex-end;
    width: 30%;
  }
}

.cap {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  letter-spacing: 0.4em;
  color: var(--ft-mute);
}

@container (min-width: 560px) {
  .cap {
    text-align: right;
  }
}

.slots,
.seals {
  display: flex;
  gap: 5px;
}

.slot {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1.2px solid var(--ft-ink);
  font-size: 11px;
  background: #f3ebd8;
}

.slot.has {
  color: var(--ft-paper);
  background: var(--ft-ink);
}

.seal {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-family: var(--h-story);
  font-size: 12px;
  color: var(--ft-rubric);
  cursor: pointer;
  background: transparent;
  box-shadow: inset 0 0 0 1.2px var(--ft-rubric);
}

.seal:not(.is-set) {
  border: 1px dashed transparent;
}

.seal.is-set {
  color: #f3e6c8;
  background: var(--ft-rubric);
  box-shadow:
    inset 0 0 0 2px #8c2914,
    0 1px 0 #6b1d0d;
}

.seal.is-pressed {
  animation: press 0.5s var(--h-ease);
}

.keys {
  display: flex;
  gap: 6px;
}

.ft-key {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--ft-ink);
  font-family: var(--h-story);
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--ft-ink);
  cursor: pointer;
  background: rgba(236, 226, 203, 0.9);
}

.ft-key[aria-pressed='true'] {
  border-color: var(--ft-rubric);
  color: var(--ft-rubric);
}

/* Scene heading: a cartouche */

.cartouche {
  position: absolute;
  top: 44%;
  left: 50%;
  display: grid;
  gap: 4px;
  justify-items: center;
  padding: 14px 28px 12px;
  border: 1.5px solid var(--ft-ink);
  outline: 1px solid var(--ft-ink);
  outline-offset: 3px;
  background: var(--ft-paper);
  transform: translate(-50%, -50%);
}

.scene-title {
  font-size: clamp(22px, 5cqi, 30px);
  font-weight: 900;
  letter-spacing: 0.3em;
  white-space: nowrap;
}

.scene-sub {
  font-size: 13px;
  font-style: italic;
  color: var(--ft-mute);
}

.ft-scene-enter-active,
.ft-scene-leave-active {
  transition: opacity 0.6s var(--h-ease);
}

.ft-scene-enter-from,
.ft-scene-leave-to {
  opacity: 0;
}

/* Choices */

.options {
  position: absolute;
  z-index: 1;
  top: 118px;
  left: 50%;
  display: grid;
  width: min(86%, 300px);
  border-top: 1.5px solid var(--ft-ink);
  border-bottom: 1.5px solid var(--ft-ink);
  background: rgba(236, 226, 203, 0.95);
  transform: translateX(-50%);
}

@container (min-width: 560px) {
  .options {
    top: 34%;
    left: 36%;
    transform: translate(-50%, -30%);
  }
}

.post {
  display: grid;
  gap: 2px;
  padding: 10px 10px 8px 28px;
  font-family: var(--h-story);
  color: var(--ft-ink);
  text-align: left;
  cursor: pointer;
  position: relative;
}

.post + .post {
  border-top: 1px solid rgba(42, 31, 22, 0.35);
}

.post::before {
  content: '❧';
  position: absolute;
  left: 8px;
  top: 10px;
  color: var(--ft-rubric);
}

.post-label {
  font-size: 15px;
  font-weight: 700;
}

.post-sub {
  font-family: var(--h-mono);
  font-size: 10.5px;
  color: var(--ft-mute);
}

.post:hover:not(:disabled) .post-label,
.post:focus-visible .post-label {
  color: var(--ft-rubric);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.post.is-locked {
  cursor: not-allowed;
}

.post.is-locked .post-label {
  color: #9b8b74;
  text-decoration: line-through;
  text-decoration-color: var(--ft-rubric);
}

/* Text */

.folio {
  position: relative;
  z-index: 1;
  min-height: 104px;
  padding: 20px 18px 12px;
  border-top: 1.5px solid var(--ft-ink);
  border-bottom: 1.5px solid var(--ft-ink);
  cursor: pointer;
  background: rgba(236, 226, 203, 0.96);
  box-shadow:
    0 -5px 0 -3.5px var(--ft-ink),
    0 5px 0 -3.5px var(--ft-ink);
}

.speaker {
  position: absolute;
  top: 0;
  left: 16px;
  padding: 0 8px;
  font-size: 12px;
  letter-spacing: 0.4em;
  color: var(--ft-rubric);
  background: var(--ft-paper);
  transform: translateY(-50%);
}

.said {
  margin: 0;
  padding-right: 24px;
  font-size: 16px;
  line-height: 1.8;
}

.said :deep(.h-char:first-child) {
  float: left;
  margin: 4px 6px 0 0;
  font-size: 2.1em;
  font-weight: 900;
  line-height: 1;
  color: var(--ft-rubric);
}

.folio.is-narration .said {
  font-style: italic;
}

.next {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  cursor: pointer;
}

.next:disabled {
  cursor: default;
}

.quill {
  font-size: 16px;
  color: var(--ft-rubric);
}

/* Journal */

.journal {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: rgba(236, 226, 203, 0.98);
}

.journal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1.5px solid var(--ft-ink);
  font-size: 15px;
  letter-spacing: 0.4em;
  color: var(--ft-rubric);
}

.journal-list {
  flex: 1;
  margin: 10px 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.journal-list li {
  padding: 10px 0;
  border-bottom: 1px solid rgba(42, 31, 22, 0.2);
}

.journal-list .who {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--ft-rubric);
}

.journal-list p {
  margin: 2px 0 0;
  line-height: 1.75;
}

.ft :is(a, button):focus-visible {
  outline: 2px solid var(--ft-rubric);
  outline-offset: 2px;
}

@keyframes press {
  40% {
    transform: scale(0.82);
  }
}

@media (prefers-reduced-motion: reduce) {
  .seal.is-pressed {
    animation: none;
  }

  .marker,
  .ft-scene-enter-active,
  .ft-scene-leave-active {
    transition: none;
  }
}
</style>
