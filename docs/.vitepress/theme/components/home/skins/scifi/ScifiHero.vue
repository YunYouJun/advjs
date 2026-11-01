<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useHero } from '../../../../composables/hero'
import { useParallax, useReducedMotion } from '../../../../composables/home'
import HomeTypewriter from '../../HomeTypewriter.vue'
import ScifiChart from './ScifiChart.vue'

const {
  t,
  lines,
  choices,
  stage,
  logButton,
  logClose,
  inView,
  index,
  advances,
  headInstant,
  lineInstant,
  lineDone,
  lineDelay,
  headDuration,
  auto,
  logOpen,
  backlog,
  advance,
  openLog,
  closeLog,
  HEAD_SPEED,
  LINE_SPEED,
} = useHero()

// Depth in the chart: background stars, then the instrument rings, then the system, then the lock.
useParallax(stage)

// Mission clock: seconds since the page opened, ticking only while someone watches.
const reduced = useReducedMotion()
const seconds = ref(0)
let tick: ReturnType<typeof setInterval> | undefined
watch([inView, reduced], () => {
  clearInterval(tick)
  if (inView.value && !reduced.value)
    tick = setInterval(() => seconds.value++, 1000)
}, { immediate: true })
onBeforeUnmount(() => clearInterval(tick))

const clock = computed(() => {
  const s = seconds.value
  return `T+${String(Math.floor(s / 60)).padStart(4, '0')}.${String(s % 60).padStart(2, '0')}`
})

const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <div
    ref="stage"
    class="stage sf"
    :class="{ 'is-still': !inView }"
    :style="{ '--choices-delay': `${headDuration + 200}ms` }"
  >
    <div class="scenery" aria-hidden="true">
      <div class="grid" />
      <ScifiChart class="chart" />
    </div>

    <div class="ui">
      <div class="hud">
        <p class="station">
          <b>{{ t.hero.scifi.station }}</b>
          <span>{{ t.hero.scifi.log }}</span>
        </p>
        <p class="target">
          {{ t.hero.scifi.target }}
        </p>
        <div class="quick-menu">
          <span class="clock" aria-hidden="true">{{ clock }}</span>
          <button type="button" class="sf-key" :aria-pressed="auto" @click="auto = !auto">
            {{ t.ui.auto }}
          </button>
          <button ref="logButton" type="button" class="sf-key" @click="openLog">
            {{ t.hero.log }}
          </button>
        </div>
      </div>

      <nav class="menu" :aria-label="t.hero.menu">
        <span class="menu-label" aria-hidden="true">{{ t.hero.scifi.menu }}</span>
        <a
          v-for="(choice, i) in choices"
          :key="choice.link"
          class="cmd"
          :style="{ '--n': i }"
          :href="choice.link"
          :target="choice.external ? '_blank' : undefined"
          :rel="choice.external ? 'noreferrer' : undefined"
        >
          <span class="cmd-no" aria-hidden="true">{{ pad(i + 1) }}</span>
          <span class="cmd-text">
            <span class="cmd-label">{{ choice.label }}</span>
            <span class="cmd-sub">{{ choice.sub }}</span>
          </span>
          <span class="cmd-arrow i-ri-arrow-right-line" aria-hidden="true" />
        </a>
      </nav>

      <div class="log-box" @click="advance">
        <p class="who">
          <b>@{{ t.hero.scifi.speaker }}</b>
          <span>LOG 0427-{{ pad(index + 1) }}</span>
        </p>
        <HomeTypewriter
          as="h1"
          class="headline"
          :text="t.hero.headline"
          :speed="HEAD_SPEED"
          :instant="headInstant"
          @done="headInstant = true"
        />
        <HomeTypewriter
          :key="advances"
          as="p"
          class="line"
          :text="lines[index]"
          :speed="LINE_SPEED"
          :delay="lineDelay"
          :instant="lineInstant"
          @done="lineDone = true"
        />
        <div class="box-foot">
          <span class="progress" aria-hidden="true">
            <i v-for="(_, i) in lines" :key="i" :class="{ 'is-done': i < index, 'is-here': i === index }" />
          </span>
          <button
            type="button"
            class="next"
            :aria-label="lineDone ? t.ui.next : t.ui.reveal"
            @click.stop="advance"
          >
            <span v-show="lineDone" class="caret" />
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="logOpen"
      class="log"
      role="dialog"
      aria-modal="true"
      :aria-label="t.hero.logLabel"
    >
      <div class="log-head">
        <span>{{ t.hero.log }}</span>
        <button ref="logClose" type="button" class="sf-key" @click="closeLog">
          {{ t.hero.close }}
        </button>
      </div>
      <ol class="log-list">
        <li>
          <span class="stamp">LOG 0427-00</span>
          <p class="log-headline">
            {{ t.hero.headline }}
          </p>
        </li>
        <li v-for="(line, i) in backlog" :key="line">
          <span class="stamp">LOG 0427-{{ pad(i + 1) }}</span>
          <p>{{ line }}</p>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.sf {
  --sf-bg: #0c0d0e;
  --sf-ink: #e9e7e1;
  --sf-mute: #8d8a83;
  --sf-rule: #2a2b2c;
  --sf-signal: #ff5a1f;
  --sf-mono: var(--h-mono);
  --windows-top: 0;
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: max(660px, calc(100svh - var(--vp-nav-height) - var(--h-switcher) - 24px));
  overflow: hidden;
  border-radius: 6px;
  color: var(--sf-ink);
  background: var(--sf-bg);
  box-shadow: inset 0 0 0 1px var(--sf-rule);
}

@media (min-width: 960px) {
  .sf {
    min-height: 0;
    height: clamp(620px, calc(100svh - var(--vp-nav-height) - var(--h-switcher) - 32px), 860px);
  }
}

.stage.is-still {
  --drive: paused;
}

.scenery {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

/* Plotting paper: hairlines every 32px, with a heavier line every fourth */
.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(233, 231, 225, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(233, 231, 225, 0.05) 1px, transparent 1px),
    linear-gradient(rgba(233, 231, 225, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(233, 231, 225, 0.05) 1px, transparent 1px);
  background-size:
    32px 32px,
    32px 32px,
    128px 128px,
    128px 128px;
  background-position: -1px -1px;
}

.chart :deep(.stars) {
  translate: calc(var(--px, 0) * -3px) calc(var(--py, 0) * -3px);
}

.chart :deep(:is(.rings, .ticks, .labels)) {
  translate: calc(var(--px, 0) * -6px) calc(var(--py, 0) * -5px);
}

.chart :deep(:is(.precess, .planet, .planet-ring, .orbit)) {
  translate: calc(var(--px, 0) * -10px) calc(var(--py, 0) * -7px);
}

.chart :deep(.lock) {
  translate: calc(var(--px, 0) * -14px) calc(var(--py, 0) * -9px);
}

.chart {
  position: absolute;
  top: 12%;
  left: 50%;
  width: min(108%, 620px);
  transform: translateX(-50%);
  opacity: 0.6;
}

@media (min-width: 960px) {
  .chart {
    top: 6%;
    left: 4%;
    width: min(56%, 640px);
    transform: none;
    opacity: 1;
  }
}

/* UI */

.ui {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 16px;
}

@media (min-width: 640px) {
  .ui {
    padding: 20px 24px 24px;
  }
}

@media (min-width: 960px) {
  .ui {
    padding: 24px 28px 28px;
  }
}

.hud {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    'station menu'
    'target target';
  gap: 10px 16px;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--sf-rule);
  font-family: var(--sf-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--sf-mute);
}

@media (min-width: 960px) {
  .hud {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'station target menu';
  }
}

.hud p {
  margin: 0;
}

.station {
  grid-area: station;
  display: flex;
  gap: 12px;
  align-items: center;
}

.station b {
  padding: 3px 7px;
  font-weight: 600;
  color: var(--sf-bg);
  background: var(--sf-signal);
}

.target {
  grid-area: target;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--sf-ink);
}

@media (min-width: 960px) {
  .target {
    text-align: center;
  }
}

.quick-menu {
  grid-area: menu;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.clock {
  display: none;
  margin-right: 8px;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 640px) {
  .clock {
    display: inline;
  }
}

.sf-key {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--sf-rule);
  font-family: var(--sf-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--sf-ink);
  cursor: pointer;
  background: var(--sf-bg);
  transition:
    border-color 0.15s,
    color 0.15s;
}

.sf-key:hover {
  border-color: var(--sf-ink);
}

.sf-key[aria-pressed='true'] {
  border-color: var(--sf-signal);
  color: var(--sf-signal);
}

.sf-key[aria-pressed]::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 8px;
  vertical-align: 1px;
  background: currentColor;
  opacity: 0.4;
}

.sf-key[aria-pressed='true']::before {
  opacity: 1;
}

/* Commands */

.menu {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  width: min(100%, 360px);
  margin: 0 auto;
  padding: 32px 0 24px;
}

@media (min-width: 960px) {
  .menu {
    margin-right: 2%;
  }
}

.menu-label {
  padding-bottom: 4px;
  font-family: var(--sf-mono);
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--sf-mute);
}

.cmd {
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 56px;
  padding: 8px 14px;
  border: 1px solid rgba(233, 231, 225, 0.5);
  color: var(--sf-ink);
  text-decoration: none;
  background: rgba(12, 13, 14, 0.82);
  animation: cmd-in 0.4s steps(4) both;
  animation-delay: calc(var(--choices-delay) + var(--n) * 120ms);
  transition:
    color 0.12s,
    background-color 0.12s,
    border-color 0.12s;
}

.cmd:hover,
.cmd:focus-visible {
  border-color: var(--sf-ink);
  color: var(--sf-bg);
  background: var(--sf-ink);
}

.cmd-no {
  font-family: var(--sf-mono);
  font-size: 12px;
  color: var(--sf-signal);
}

.cmd:hover .cmd-no,
.cmd:focus-visible .cmd-no {
  color: inherit;
}

.cmd-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.cmd-label {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.cmd-sub {
  overflow: hidden;
  font-family: var(--sf-mono);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0.6;
}

.cmd-arrow {
  flex: none;
  margin-left: auto;
  font-size: 16px;
}

/* Dialogue: a log entry, bracketed */

.log-box {
  position: relative;
  padding: 18px 18px 14px;
  border: 1px solid #3a3b3c;
  cursor: pointer;
  background: rgba(12, 13, 14, 0.9);
}

.log-box::before,
.log-box::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  border: solid var(--sf-signal);
}

.log-box::before {
  top: -1px;
  left: -1px;
  border-width: 2px 0 0 2px;
}

.log-box::after {
  right: -1px;
  bottom: -1px;
  border-width: 0 2px 2px 0;
}

@media (min-width: 640px) {
  .log-box {
    padding: 22px 28px 18px;
  }
}

.who {
  display: flex;
  gap: 16px;
  margin: 0 0 10px;
  font-family: var(--sf-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--sf-mute);
}

.who b {
  font-weight: 600;
  color: var(--sf-signal);
}

.headline {
  margin: 0;
  font-family: var(--h-system);
  font-size: clamp(26px, 6.2vw, 52px);
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
  text-wrap: balance;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.adv-home[data-locale='zh'] .headline {
  letter-spacing: 0.02em;
}

/* Characters land whole, like a terminal printing, not fading in */
.sf :deep(.h-char) {
  animation-name: sf-char;
  animation-duration: 0.01s;
  filter: none;
}

.line {
  min-height: calc(1.8em * 3);
  margin: 12px 0 0;
  font-size: 16px;
  line-height: 1.8;
  color: #c9c6be;
}

@media (min-width: 640px) {
  .line {
    min-height: calc(1.8em * 2);
    font-size: 17px;
  }
}

@media (min-width: 960px) {
  .line {
    max-width: 54em;
  }
}

.box-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.progress {
  display: flex;
  gap: 3px;
}

.progress i {
  width: 28px;
  height: 4px;
  background: var(--sf-rule);
}

.progress i.is-done {
  background: var(--sf-ink);
}

.progress i.is-here {
  background: var(--sf-signal);
}

.next {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin: -8px -10px -10px 0;
  cursor: pointer;
}

/* Block cursor: waiting for input */
.caret {
  width: 10px;
  height: 18px;
  background: var(--sf-signal);
  animation: sf-blink 1s steps(1) infinite;
}

/* Backlog */

.log {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: rgba(12, 13, 14, 0.97);
}

.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--sf-rule);
  font-family: var(--sf-mono);
  font-size: 12px;
  letter-spacing: 0.2em;
}

.log-list {
  flex: 1;
  width: 100%;
  max-width: 46rem;
  margin: 12px auto 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.log-list li {
  display: grid;
  gap: 6px;
  padding: 16px 0;
  border-bottom: 1px dashed var(--sf-rule);
}

.stamp {
  font-family: var(--sf-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--sf-signal);
}

.log-list p {
  margin: 0;
  line-height: 1.8;
  color: #c9c6be;
}

.log-list .log-headline {
  font-size: 20px;
  font-weight: 700;
  color: var(--sf-ink);
}

.sf :is(a, button):focus-visible {
  outline: 2px solid var(--sf-signal);
  outline-offset: 2px;
}

@keyframes sf-char {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes sf-blink {
  50% {
    opacity: 0;
  }
}

@keyframes cmd-in {
  from {
    opacity: 0;
    clip-path: inset(0 100% 0 0);
  }
  to {
    opacity: 1;
    clip-path: inset(0 0 0 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cmd,
  .caret {
    animation: none;
  }

  .cmd,
  .sf-key {
    transition: none;
  }
}
</style>
