<script setup lang="ts">
import { computed } from 'vue'
import { useHomeCopy } from '../../../../composables/home'
import { usePlayer } from '../../../../composables/player'
import HomeTypewriter from '../../HomeTypewriter.vue'
import RomanceRoom from './RomanceRoom.vue'

defineProps<{ still?: boolean }>()

const t = useHomeCopy()
const { current, currentId, choices, said, typed, instant, auto, variables, changes, when, next, choose } = usePlayer()

const TILT = [-1.8, 1.4, -0.6]

/** `affection` as hearts: one per point, with room to grow. */
const affection = computed(() => Number(variables.value.affection ?? 0))
const hearts = computed(() => Math.max(3, affection.value))
const rose = computed(() => changes.value.some(c => c.key === 'affection' && Number(c.to) > Number(c.from ?? 0)))

/** She is on stage from her first line until the scene changes. */
const cast = computed(() => current.value?.kind !== 'scene' && !!said.value)
</script>

<template>
  <div class="screen rm" :class="{ 'is-still': still }">
    <RomanceRoom class="scenery" :cast="cast" />

    <div class="top">
      <p class="meter" :aria-label="`affection ${affection}`">
        <span class="meter-key">affection</span>
        <span class="hearts" aria-hidden="true">
          <svg
            v-for="n in hearts"
            :key="n"
            viewBox="0 0 16 16"
            :class="{ on: n <= affection, pop: rose && n === affection }"
          ><path d="M8 13.6 2.7 8.4a3.1 3.1 0 0 1 4.4-4.4L8 4.9l.9-.9a3.1 3.1 0 0 1 4.4 4.4z" /></svg>
        </span>
        <span v-if="rose" :key="affection" class="plus" aria-hidden="true">+1</span>
      </p>
      <button type="button" class="rm-pill" :aria-pressed="auto" @click="auto = !auto">
        {{ t.ui.auto }}
      </button>
    </div>

    <Transition name="rm-scene">
      <div v-if="current?.kind === 'scene'" :key="currentId" class="scene-card">
        <span class="episode">{#{{ currentId }}}</span>
        <p class="scene-title">
          {{ current.data!.place }}
        </p>
        <p class="scene-sub">
          {{ current.data!.time }}<template v-if="current.data!.inOrOut">
            · {{ current.data!.inOrOut }}
          </template>
        </p>
      </div>
    </Transition>

    <div v-if="choices.length" class="options">
      <button
        v-for="(choice, i) in choices"
        :key="`${currentId}-${choice.id}`"
        type="button"
        class="note"
        :class="{ 'is-locked': choice.locked }"
        :style="{ '--n': i, '--tilt': `${TILT[i % TILT.length]}deg` }"
        :disabled="choice.locked"
        @click="choose(choice)"
      >
        <span class="note-label">{{ choice.label }}</span>
        <span class="note-sub">
          <template v-if="choice.effects.length">{{ choice.effects.join(' · ') }}</template>
          <template v-else-if="choice.when">when {{ choice.when }}</template>
          <template v-else>{{ choice.target }}</template>
        </span>
      </button>
    </div>

    <div v-if="said" class="box" :class="{ 'is-narration': !said.speaker }" @click="next">
      <span v-if="said.speaker" class="name">{{ said.speaker }}</span>
      <span v-if="when && !choices.length" class="when">when {{ when }}</span>
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
        <svg v-show="typed && !choices.length" class="heart" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.6 2.7 8.4a3.1 3.1 0 0 1 4.4-4.4L8 4.9l.9-.9a3.1 3.1 0 0 1 4.4 4.4z" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.rm {
  --rm-ink: #4a3a35;
  --rm-rose: #d94f6a;
  --rm-line: #ecc7b6;
  --rm-note: #fff6d5;
  --rm-round: 'Hiragino Maru Gothic ProN', 'Yuanti SC', 'YuanTi SC', 'Arial Rounded MT Bold', var(--h-system);
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;
  height: 100%;
  padding: 14px;
  overflow: hidden;
  border-radius: 20px;
  font-family: var(--rm-round);
  color: var(--rm-ink);
  background: #f3dfca;
  container-type: inline-size;
}

.screen.is-still {
  --drive: paused;
}

.scenery {
  position: absolute;
  inset: 0;
  z-index: -1;
}

.top {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  z-index: 2;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.meter {
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 253, 249, 0.94);
  box-shadow: 0 2px 0 #e2c3a3;
}

.meter-key {
  font-family: var(--h-mono);
  font-size: 11px;
  color: #9a5a3a;
}

.hearts {
  display: flex;
  gap: 3px;
}

.hearts svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--rm-rose);
  stroke-width: 1.4;
}

.hearts svg.on {
  fill: var(--rm-rose);
}

.hearts svg.pop {
  animation: heart-pop 0.6s var(--h-ease);
}

.plus {
  position: absolute;
  right: -4px;
  top: -6px;
  font-size: 12px;
  font-weight: 800;
  color: var(--rm-rose);
  animation: plus-float 1.4s var(--h-ease) both;
}

.rm-pill {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-family: var(--rm-round);
  font-size: 12px;
  font-weight: 700;
  color: #9a5a3a;
  cursor: pointer;
  background: rgba(255, 253, 249, 0.94);
  box-shadow: 0 2px 0 #e2c3a3;
}

.rm-pill[aria-pressed]::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e2c3a3;
}

.rm-pill[aria-pressed='true'] {
  color: var(--rm-rose);
}

.rm-pill[aria-pressed='true']::before {
  background: var(--rm-rose);
}

/* Scene heading: an episode card */

.scene-card {
  position: absolute;
  top: 46%;
  left: 50%;
  display: grid;
  gap: 4px;
  justify-items: center;
  padding: 18px 30px 16px;
  border-radius: 20px;
  background: rgba(255, 253, 249, 0.95);
  box-shadow:
    0 0 0 3px #fff,
    0 0 0 5px var(--rm-line);
  transform: translate(-50%, -50%);
}

.episode {
  padding: 2px 10px;
  border-radius: 999px;
  font-family: var(--h-mono);
  font-size: 11px;
  color: #fff;
  background: var(--rm-rose);
}

.scene-title {
  margin: 4px 0 0;
  font-size: clamp(22px, 5cqi, 30px);
  font-weight: 800;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.scene-sub {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.1em;
  color: #9a7a6a;
}

.rm-scene-enter-active,
.rm-scene-leave-active {
  transition:
    opacity 0.5s var(--h-ease),
    transform 0.6s var(--h-ease);
}

.rm-scene-enter-from,
.rm-scene-leave-to {
  opacity: 0;
  transform: translate(-50%, -40%);
}

/* Choices: sticky notes */

.options {
  position: absolute;
  z-index: 1;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 34%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
}

@container (min-width: 560px) {
  .options {
    align-items: flex-start;
    padding-left: 10%;
  }
}

.note {
  position: relative;
  display: grid;
  gap: 3px;
  width: min(100%, 250px);
  padding: 14px 16px 10px;
  font-family: var(--rm-round);
  color: var(--rm-ink);
  text-align: left;
  cursor: pointer;
  background: var(--rm-note);
  box-shadow: 0 6px 12px -4px rgba(120, 70, 40, 0.3);
  transform: rotate(var(--tilt));
  animation: note-in 0.45s var(--h-ease) both;
  animation-delay: calc(var(--n) * 90ms);
  transition: transform 0.25s var(--h-ease);
}

.note::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 50%;
  width: 48px;
  height: 14px;
  margin-left: -24px;
  background: rgba(217, 79, 106, 0.28);
}

.note:hover:not(:disabled),
.note:focus-visible {
  transform: rotate(0deg) translateY(-3px);
}

.note.is-locked {
  opacity: 0.55;
  cursor: not-allowed;
}

.note-label {
  font-size: 15px;
  font-weight: 800;
}

.note-sub {
  font-family: var(--h-mono);
  font-size: 10.5px;
  color: var(--rm-rose);
}

/* Dialogue */

.box {
  position: relative;
  z-index: 1;
  min-height: 108px;
  padding: 26px 18px 14px;
  border-radius: 18px;
  cursor: pointer;
  background: rgba(255, 253, 249, 0.95);
  box-shadow:
    0 0 0 3px #fff,
    0 0 0 5px var(--rm-line);
}

.name {
  position: absolute;
  top: 0;
  left: 18px;
  padding: 4px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #fff;
  background: var(--rm-rose);
  box-shadow: 0 0 0 3px #fff;
  transform: translateY(-50%);
}

.when {
  position: absolute;
  top: 0;
  right: 18px;
  padding: 3px 10px;
  border-radius: 999px;
  font-family: var(--h-mono);
  font-size: 10.5px;
  color: var(--rm-rose);
  background: #fff;
  box-shadow: 0 0 0 1.5px var(--rm-rose);
  transform: translateY(-50%);
}

.said {
  margin: 0;
  padding-right: 24px;
  font-size: 16px;
  line-height: 1.8;
  letter-spacing: 0.02em;
}

.box.is-narration .said {
  color: #8a6f62;
}

@container (min-width: 560px) {
  .said {
    font-size: 17px;
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
  cursor: pointer;
}

.next:disabled {
  cursor: default;
}

.heart {
  width: 16px;
  height: 16px;
  fill: var(--rm-rose);
  animation: heart-beat 1.2s ease-in-out infinite;
}

.rm :is(a, button):focus-visible {
  outline: 2px solid var(--rm-rose);
  outline-offset: 3px;
}

@keyframes note-in {
  from {
    opacity: 0;
    transform: rotate(var(--tilt)) translateY(-12px);
  }
}

@keyframes heart-pop {
  40% {
    transform: scale(1.5);
  }
}

@keyframes plus-float {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-16px);
  }
}

@keyframes heart-beat {
  0%,
  60%,
  100% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rm-scene-enter-active,
  .rm-scene-leave-active {
    transition: none;
  }

  .note,
  .heart,
  .hearts svg.pop,
  .plus {
    animation: none;
  }

  .note {
    transition: none;
  }
}
</style>
