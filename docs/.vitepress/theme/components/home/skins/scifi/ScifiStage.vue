<script setup lang="ts">
import { computed } from 'vue'
import { useHomeCopy } from '../../../../composables/home'
import { usePlayer } from '../../../../composables/player'
import HomeTypewriter from '../../HomeTypewriter.vue'
import ScifiChart from './ScifiChart.vue'

defineProps<{ still?: boolean }>()

const t = useHomeCopy()
const { current, currentId, choices, said, typed, instant, auto, variables, changes, when, next, choose } = usePlayer()

/** Readouts with a scale get a segmented bar. */
const SCALES: Record<string, number> = { civilizationLevel: 5 }

const readouts = computed(() => Object.entries(variables.value).map(([key, value]) => {
  const change = changes.value.find(c => c.key === key)
  const delta = change && typeof change.from === 'number' && typeof change.to === 'number' ? change.to - change.from : undefined
  return {
    key,
    value: typeof value === 'number' ? String(value).padStart(2, '0') : String(value),
    scale: SCALES[key],
    level: Number(value),
    changed: !!change,
    delta: delta === undefined ? undefined : `${delta > 0 ? '+' : ''}${delta}`,
  }
}))

const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <div class="screen sf" :class="{ 'is-still': still }">
    <div class="grid" aria-hidden="true" />
    <ScifiChart class="chart" :reading="`CIV ${variables.civilizationLevel ?? '--'}`" aria-hidden="true" />

    <div class="hud">
      <span class="tag">OBS-01</span>
      <span class="node">#{{ currentId }}</span>
      <button type="button" class="sf-key" :aria-pressed="auto" @click="auto = !auto">
        {{ t.ui.auto }}
      </button>
    </div>

    <!-- The runtime's variables, read straight from runtime.state -->
    <dl class="tele" :aria-label="t.script.variables">
      <div v-for="r in readouts" :key="r.key" class="row" :class="{ 'is-changed': r.changed }">
        <dt>{{ r.key }}</dt>
        <dd>
          <span :key="r.value" class="value">{{ r.value }}</span>
          <span v-if="r.delta" class="delta">{{ r.delta }}</span>
        </dd>
        <span v-if="r.scale" class="bar" aria-hidden="true">
          <i v-for="n in r.scale" :key="n" :class="{ on: n <= r.level }" />
        </span>
      </div>
    </dl>

    <Transition name="sf-scene">
      <div v-if="current?.kind === 'scene'" :key="currentId" class="scene-card">
        <span class="scene-anchor">{#{{ currentId }}}</span>
        <p class="scene-title">
          <span>{{ current.data!.place }}</span>
          <span>{{ current.data!.time }}</span>
          <span v-if="current.data!.inOrOut">{{ current.data!.inOrOut }}</span>
        </p>
      </div>
    </Transition>

    <div v-if="choices.length" class="options">
      <button
        v-for="(choice, i) in choices"
        :key="`${currentId}-${choice.id}`"
        type="button"
        class="cmd"
        :class="{ 'is-locked': choice.locked }"
        :style="{ '--n': i }"
        :disabled="choice.locked"
        @click="choose(choice)"
      >
        <span class="cmd-no" aria-hidden="true">{{ pad(i + 1) }}</span>
        <span class="cmd-text">
          <span class="cmd-label">{{ choice.label }}</span>
          <span v-if="choice.when" class="cmd-when">
            when {{ choice.when }}<template v-if="choice.locked"> · {{ t.script.locked }}</template>
          </span>
          <span v-else class="cmd-when">{{ choice.target }}<template v-for="effect in choice.effects" :key="effect"> · {{ effect }}</template></span>
        </span>
      </button>
    </div>

    <div v-if="said" class="log-box" @click="next">
      <p class="who">
        <b>{{ said.speaker ? `@${said.speaker}` : '>' }}</b>
        <span v-if="when && !choices.length" class="when">when {{ when }} ✓</span>
      </p>
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
        <span v-show="typed && !choices.length" class="caret" />
      </button>
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
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;
  height: 100%;
  padding: 12px;
  overflow: hidden;
  border-radius: 6px;
  color: var(--sf-ink);
  background: var(--sf-bg);
  box-shadow: inset 0 0 0 1px var(--sf-rule);
  container-type: inline-size;
}

.screen.is-still {
  --drive: paused;
}

.grid {
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image:
    linear-gradient(rgba(233, 231, 225, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(233, 231, 225, 0.05) 1px, transparent 1px);
  background-size: 28px 28px;
}

.chart {
  position: absolute;
  z-index: -1;
  top: 40px;
  left: -14%;
  width: 92%;
  opacity: 0.5;
}

@container (min-width: 560px) {
  .chart {
    top: 40px;
    left: -8%;
    width: 64%;
    opacity: 0.9;
  }
}

.hud {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  font-family: var(--h-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--sf-mute);
}

.tag {
  padding: 2px 6px;
  font-weight: 600;
  color: var(--sf-bg);
  background: var(--sf-signal);
}

.node {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sf-key {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--sf-rule);
  font-family: var(--h-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--sf-ink);
  cursor: pointer;
  background: var(--sf-bg);
}

.sf-key[aria-pressed='true'] {
  border-color: var(--sf-signal);
  color: var(--sf-signal);
}

/* Telemetry */

.tele {
  position: absolute;
  top: 48px;
  left: 12px;
  right: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0 16px;
  margin: 0;
  font-family: var(--h-mono);
}

@container (min-width: 560px) {
  .tele {
    left: auto;
    width: 38%;
    grid-template-columns: 1fr;
  }
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  padding: 8px 0;
  border-bottom: 1px solid var(--sf-rule);
}

.row dt {
  overflow: hidden;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--sf-mute);
}

.row dd {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin: 0;
}

.value {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.row.is-changed .value {
  color: var(--sf-signal);
  animation: sf-flip 0.5s steps(3) both;
}

.delta {
  font-size: 10px;
  color: var(--sf-signal);
}

.bar {
  grid-column: 1 / -1;
  display: flex;
  gap: 2px;
  margin-top: 8px;
}

.bar i {
  flex: 1;
  height: 5px;
  background: var(--sf-rule);
  transition: background-color 0.3s steps(2);
}

.bar i.on {
  background: var(--sf-ink);
}

.row.is-changed .bar i.on:nth-last-child(1 of .on) {
  background: var(--sf-signal);
}

/* Scene heading */

.scene-card {
  position: absolute;
  top: 50%;
  left: 12px;
  right: 12px;
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 18px 12px;
  border-top: 1px solid var(--sf-ink);
  border-bottom: 1px solid var(--sf-ink);
  background: rgba(12, 13, 14, 0.92);
  transform: translateY(-60%);
}

.scene-anchor {
  font-family: var(--h-mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--sf-signal);
}

.scene-title {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2em 0.8em;
  justify-content: center;
  margin: 0;
  font-size: clamp(18px, 4cqi, 26px);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.sf-scene-enter-active {
  animation: sf-print 0.5s steps(5) both;
}

.sf-scene-leave-active {
  transition: opacity 0.2s;
}

.sf-scene-leave-to {
  opacity: 0;
}

/* Choices */

.options {
  position: absolute;
  z-index: 1;
  top: 40%;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 0 16px;
  transform: translateY(-40%);
}

@container (min-width: 560px) {
  .options {
    right: 40%;
    top: 42%;
  }
}

.cmd {
  display: flex;
  gap: 12px;
  align-items: center;
  width: min(100%, 300px);
  min-height: 50px;
  padding: 6px 12px;
  border: 1px solid rgba(233, 231, 225, 0.6);
  color: var(--sf-ink);
  text-align: left;
  cursor: pointer;
  background: rgba(12, 13, 14, 0.9);
  animation: sf-cmd 0.35s steps(4) both;
  animation-delay: calc(var(--n) * 90ms);
}

.cmd:hover:not(:disabled),
.cmd:focus-visible {
  color: var(--sf-bg);
  background: var(--sf-ink);
}

.cmd.is-locked {
  border-style: dashed;
  border-color: var(--sf-signal);
  color: var(--sf-mute);
  cursor: not-allowed;
}

.cmd-no {
  font-family: var(--h-mono);
  font-size: 11px;
  color: var(--sf-signal);
}

.cmd:hover:not(:disabled) .cmd-no {
  color: inherit;
}

.cmd-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.cmd-label {
  font-size: 14px;
  font-weight: 600;
}

.cmd-when {
  overflow: hidden;
  font-family: var(--h-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0.7;
}

.is-locked .cmd-when {
  color: var(--sf-signal);
  opacity: 1;
}

/* Dialogue */

.log-box {
  position: relative;
  z-index: 1;
  min-height: 104px;
  padding: 14px 16px 12px;
  border: 1px solid #3a3b3c;
  cursor: pointer;
  background: rgba(12, 13, 14, 0.94);
}

.log-box::before,
.log-box::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
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

.who {
  display: flex;
  gap: 12px;
  margin: 0 0 6px;
  font-family: var(--h-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--sf-mute);
}

.who b {
  font-weight: 600;
  color: var(--sf-signal);
}

.when {
  overflow: hidden;
  letter-spacing: 0.04em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.said {
  margin: 0;
  padding-right: 24px;
  font-size: 16px;
  line-height: 1.75;
  letter-spacing: 0.02em;
}

@container (min-width: 560px) {
  .said {
    font-size: 17px;
  }
}

.sf :deep(.h-char) {
  animation-name: sf-char;
  animation-duration: 0.01s;
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

.caret {
  width: 9px;
  height: 16px;
  background: var(--sf-signal);
  animation: sf-blink 1s steps(1) infinite;
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

@keyframes sf-flip {
  from {
    opacity: 0.2;
    transform: translateY(-4px);
  }
}

@keyframes sf-print {
  from {
    clip-path: inset(0 0 100% 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}

@keyframes sf-cmd {
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
  .row.is-changed .value,
  .sf-scene-enter-active,
  .cmd,
  .caret {
    animation: none;
  }

  .bar i {
    transition: none;
  }
}
</style>
