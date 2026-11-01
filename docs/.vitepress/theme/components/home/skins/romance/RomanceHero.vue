<script setup lang="ts">
import { useHero } from '../../../../composables/hero'
import { useParallax } from '../../../../composables/home'
import HomeTypewriter from '../../HomeTypewriter.vue'
import RomanceRoom from './RomanceRoom.vue'

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

useParallax(stage)

/** Sticky notes sit a little crooked, each its own way. */
const TILT = [-2.2, 1.6, -0.8]
</script>

<template>
  <div
    ref="stage"
    class="stage rm"
    :class="{ 'is-still': !inView }"
    :style="{ '--choices-delay': `${headDuration + 200}ms` }"
  >
    <RomanceRoom class="scenery" />

    <div class="ui">
      <div class="ui-top">
        <p class="title-card">
          <span class="episode">{{ t.hero.romance.chapter }}</span>
          <span class="title">{{ t.hero.romance.title }}</span>
          <span class="date">{{ t.hero.romance.date }}</span>
        </p>
        <div class="quick-menu">
          <button type="button" class="rm-pill" :aria-pressed="auto" @click="auto = !auto">
            {{ t.ui.auto }}
          </button>
          <button ref="logButton" type="button" class="rm-pill" @click="openLog">
            {{ t.hero.log }}
          </button>
        </div>
      </div>

      <nav class="notes" :aria-label="t.hero.menu">
        <span class="notes-label" aria-hidden="true">{{ t.hero.romance.menu }}</span>
        <a
          v-for="(choice, i) in choices"
          :key="choice.link"
          class="note"
          :style="{ '--n': i, '--tilt': `${TILT[i]}deg` }"
          :href="choice.link"
          :target="choice.external ? '_blank' : undefined"
          :rel="choice.external ? 'noreferrer' : undefined"
        >
          <span class="note-label">{{ choice.label }}</span>
          <span class="note-sub">{{ choice.sub }}</span>
        </a>
      </nav>

      <div class="box" @click="advance">
        <span class="name">{{ t.hero.romance.speaker }}</span>
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
          <span class="pages" aria-hidden="true">
            <i v-for="(_, i) in lines" :key="i" :class="{ 'is-read': i < index, 'is-here': i === index }" />
          </span>
          <button
            type="button"
            class="next"
            :aria-label="lineDone ? t.ui.next : t.ui.reveal"
            @click.stop="advance"
          >
            <svg v-show="lineDone" class="heart" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.6 2.7 8.4a3.1 3.1 0 0 1 4.4-4.4L8 4.9l.9-.9a3.1 3.1 0 0 1 4.4 4.4z" /></svg>
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
        <button ref="logClose" type="button" class="rm-pill" @click="closeLog">
          {{ t.hero.close }}
        </button>
      </div>
      <ol class="log-list">
        <li>
          <span class="name">{{ t.hero.romance.speaker }}</span>
          <p class="log-headline">
            {{ t.hero.headline }}
          </p>
        </li>
        <li v-for="line in backlog" :key="line">
          <p>{{ line }}</p>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.rm {
  --rm-ink: #4a3a35;
  --rm-rose: #d94f6a;
  --rm-paper: #fffdf9;
  --rm-line: #ecc7b6;
  --rm-note: #fff6d5;
  --rm-round: 'Hiragino Maru Gothic ProN', 'Yuanti SC', 'YuanTi SC', 'Arial Rounded MT Bold', var(--h-system);
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: max(660px, calc(100svh - var(--vp-nav-height) - var(--h-switcher) - 24px));
  overflow: hidden;
  border-radius: 24px;
  font-family: var(--rm-round);
  color: var(--rm-ink);
  background: #f3dfca;
}

@media (min-width: 960px) {
  .rm {
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
}

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
    padding: 22px 24px 24px;
  }
}

@media (min-width: 960px) {
  .ui {
    padding: 28px 32px 30px;
  }
}

.ui-top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

/* Episode card, top left, as anime episodes open */
.title-card {
  display: grid;
  gap: 2px;
  justify-items: start;
  margin: 0;
  padding: 12px 18px 12px 16px;
  border-radius: 16px;
  background: rgba(255, 253, 249, 0.92);
  box-shadow: 0 3px 0 #e2c3a3;
}

.episode {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #fff;
  background: var(--rm-rose);
}

.title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.date {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #9a7a6a;
}

.quick-menu {
  display: flex;
  gap: 8px;
}

.rm-pill {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  font-family: var(--rm-round);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #9a5a3a;
  cursor: pointer;
  background: rgba(255, 253, 249, 0.92);
  box-shadow: 0 2px 0 #e2c3a3;
  transition:
    color 0.2s,
    transform 0.2s var(--h-ease);
}

.rm-pill:hover {
  transform: translateY(-1px);
}

.rm-pill[aria-pressed='true'] {
  color: var(--rm-rose);
}

.rm-pill[aria-pressed]::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e2c3a3;
}

.rm-pill[aria-pressed='true']::before {
  background: var(--rm-rose);
}

/* Choices: sticky notes on the window glass */

.notes {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
  justify-content: center;
  width: min(100%, 300px);
  margin: 0 auto;
  padding: 28px 0 24px;
}

@media (min-width: 960px) {
  .notes {
    margin: 0 0 0 6%;
  }
}

.notes-label {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #9a5a3a;
  background: rgba(255, 253, 249, 0.8);
}

.note {
  position: relative;
  display: grid;
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
  padding: 16px 18px 12px;
  color: var(--rm-ink);
  text-decoration: none;
  background: var(--rm-note);
  box-shadow: 0 6px 12px -4px rgba(120, 70, 40, 0.28);
  transform: rotate(var(--tilt));
  animation: note-in 0.5s var(--h-ease) both;
  animation-delay: calc(var(--choices-delay) + var(--n) * 110ms);
  transition: transform 0.25s var(--h-ease);
}

/* A strip of tape */
.note::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  width: 56px;
  height: 16px;
  margin-left: -28px;
  background: rgba(217, 79, 106, 0.28);
}

.note:hover,
.note:focus-visible {
  transform: rotate(0deg) translateY(-3px);
}

.note-label {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.note-sub {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--rm-rose);
}

/* Dialogue box */

.box {
  position: relative;
  padding: 30px 20px 16px;
  border-radius: 22px;
  cursor: pointer;
  background: rgba(255, 253, 249, 0.95);
  box-shadow:
    0 0 0 3px #fff,
    0 0 0 5px var(--rm-line),
    0 18px 36px -24px rgba(120, 60, 40, 0.5);
}

@media (min-width: 640px) {
  .box {
    padding: 32px 30px 18px;
  }
}

.name {
  position: absolute;
  top: 0;
  left: 22px;
  padding: 5px 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #fff;
  background: var(--rm-rose);
  box-shadow: 0 0 0 3px #fff;
  transform: translateY(-50%);
}

.headline {
  margin: 0;
  font-family: var(--rm-round);
  font-size: clamp(26px, 6.4vw, 52px);
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: 0.04em;
  color: var(--rm-ink);
  text-wrap: balance;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.adv-home[data-locale='en'] .headline {
  letter-spacing: 0;
}

.line {
  min-height: calc(1.85em * 3);
  margin: 10px 0 0;
  font-size: 16px;
  line-height: 1.85;
  color: #6b5850;
}

@media (min-width: 640px) {
  .line {
    min-height: calc(1.85em * 2);
    font-size: 17px;
  }
}

@media (min-width: 960px) {
  .line {
    max-width: 52em;
  }
}

.box-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.pages {
  display: flex;
  gap: 6px;
}

.pages i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--rm-line);
}

.pages i.is-read {
  background: #e7a3a3;
}

.pages i.is-here {
  width: 22px;
  border-radius: 999px;
  background: var(--rm-rose);
}

.next {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin: -8px -10px -10px 0;
  cursor: pointer;
}

.heart {
  width: 18px;
  height: 18px;
  fill: var(--rm-rose);
  animation: heart-beat 1.2s ease-in-out infinite;
}

/* Backlog */

.log {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: rgba(255, 249, 242, 0.96);
  animation: log-in 0.3s var(--h-ease) both;
}

.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.log-list {
  flex: 1;
  width: 100%;
  max-width: 44rem;
  margin: 24px auto 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.log-list li {
  position: relative;
  padding: 18px 0;
  border-bottom: 2px dotted var(--rm-line);
}

.log-list .name {
  position: static;
  display: inline-block;
  transform: none;
}

.log-list p {
  margin: 10px 0 0;
  line-height: 1.85;
}

.log-list .log-headline {
  font-size: 22px;
  font-weight: 800;
}

.rm :is(a, button):focus-visible {
  outline: 2px solid var(--rm-rose);
  outline-offset: 3px;
}

@keyframes note-in {
  from {
    opacity: 0;
    transform: rotate(var(--tilt)) translateY(-14px);
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

@keyframes log-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .note,
  .heart,
  .log {
    animation: none;
  }

  .note,
  .rm-pill {
    transition: none;
  }
}
</style>
