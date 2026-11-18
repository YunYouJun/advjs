<script setup lang="ts">
import { useHero } from '../../../../composables/hero'
import HomeTypewriter from '../../HomeTypewriter.vue'
import FantasyMap from './FantasyMap.vue'

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

const NUMERALS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ']
</script>

<template>
  <div
    ref="stage"
    class="stage ft"
    :class="{ 'is-still': !inView }"
    :style="{ '--choices-delay': `${headDuration + 200}ms` }"
  >
    <FantasyMap class="scenery" />

    <div class="ui">
      <div class="ui-top">
        <p class="cartouche">
          <span class="title">{{ t.hero.fantasy.title }}</span>
          <span class="sub">{{ t.hero.fantasy.sub }}</span>
        </p>
        <div class="quick-menu">
          <button type="button" class="ft-key" :aria-pressed="auto" @click="auto = !auto">
            {{ t.ui.auto }}
          </button>
          <button ref="logButton" type="button" class="ft-key" @click="openLog">
            {{ t.hero.log }}
          </button>
        </div>
      </div>

      <nav class="signposts" :aria-label="t.hero.menu">
        <span class="signposts-label" aria-hidden="true">{{ t.hero.fantasy.menu }}</span>
        <a
          v-for="(choice, i) in choices"
          :key="choice.link"
          class="post"
          :style="{ '--n': i }"
          :href="choice.link"
          :target="choice.external ? '_blank' : undefined"
          :rel="choice.external ? 'noreferrer' : undefined"
        >
          <span class="numeral" aria-hidden="true">{{ NUMERALS[i] }}</span>
          <span class="post-text">
            <span class="post-label">{{ choice.label }}</span>
            <span class="post-sub">{{ choice.sub }}</span>
          </span>
        </a>
      </nav>

      <div class="folio" @click="advance">
        <span class="speaker">{{ t.hero.fantasy.speaker }}</span>
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
          <span class="leaves" aria-hidden="true">
            <i v-for="(_, i) in lines" :key="i" :class="{ 'is-read': i < index, 'is-here': i === index }">❧</i>
          </span>
          <button
            type="button"
            class="next"
            :aria-label="lineDone ? t.ui.next : t.ui.reveal"
            @click.stop="advance"
          >
            <span v-show="lineDone" class="quill">✒</span>
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
        <button ref="logClose" type="button" class="ft-key" @click="closeLog">
          {{ t.hero.close }}
        </button>
      </div>
      <ol class="log-list">
        <li>
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
.ft {
  --ft-paper: #ece2cb;
  --ft-ink: #2a1f16;
  --ft-mute: #6b5a47;
  --ft-rubric: #a8321c;
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: max(660px, calc(100svh - var(--vp-nav-height) - var(--h-switcher) - 24px));
  overflow: hidden;
  border-radius: 4px;
  font-family: var(--h-story);
  color: var(--ft-ink);
  background: var(--ft-paper);
  box-shadow:
    inset 0 0 0 1px rgba(42, 31, 22, 0.35),
    inset 0 0 0 6px var(--ft-paper),
    inset 0 0 0 7px rgba(42, 31, 22, 0.6);
}

@media (min-width: 960px) {
  .ft {
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
  opacity: 0.55;
}

@media (min-width: 960px) {
  .scenery {
    opacity: 1;
  }
}

.ui {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 20px;
}

@media (min-width: 960px) {
  .ui {
    padding: 32px 36px 32px;
  }
}

.ui-top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

/* The map's title, set in a ruled cartouche */
.cartouche {
  display: grid;
  gap: 4px;
  justify-items: center;
  margin: 0;
  padding: 12px 22px 10px;
  border: 1.5px solid var(--ft-ink);
  outline: 1px solid var(--ft-ink);
  outline-offset: 3px;
  background: rgba(236, 226, 203, 0.92);
}

.title {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.3em;
}

.sub {
  font-size: 12px;
  font-style: italic;
  letter-spacing: 0.16em;
  color: var(--ft-mute);
}

.quick-menu {
  display: flex;
  gap: 8px;
}

.ft-key {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ft-ink);
  font-family: var(--h-story);
  font-size: 13px;
  letter-spacing: 0.12em;
  color: var(--ft-ink);
  cursor: pointer;
  background: rgba(236, 226, 203, 0.9);
}

.ft-key[aria-pressed='true'] {
  color: var(--ft-rubric);
  border-color: var(--ft-rubric);
}

.ft-key[aria-pressed]::before {
  content: '◆ ';
  font-size: 9px;
  vertical-align: 2px;
  opacity: 0.4;
}

.ft-key[aria-pressed='true']::before {
  opacity: 1;
}

/* Signposts: numbered entries in the margin */

.signposts {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  width: min(100%, 320px);
  margin: 0 auto;
  padding: 28px 0 24px;
}

@media (min-width: 960px) {
  .signposts {
    margin: 0 4% 0 auto;
  }
}

.signposts-label {
  margin-bottom: 6px;
  font-size: 13px;
  letter-spacing: 0.5em;
  color: var(--ft-rubric);
}

.post {
  display: flex;
  gap: 14px;
  align-items: baseline;
  padding: 12px 6px 10px;
  border-bottom: 1px solid rgba(42, 31, 22, 0.4);
  color: var(--ft-ink);
  text-decoration: none;
  background: rgba(236, 226, 203, 0.95);
  animation: post-in 0.8s var(--h-ease) both;
  animation-delay: calc(var(--choices-delay) + var(--n) * 140ms);
}

.post:first-of-type {
  border-top: 1.5px solid var(--ft-ink);
}

.post:last-of-type {
  border-bottom: 1.5px solid var(--ft-ink);
}

.numeral {
  width: 1.4em;
  font-size: 18px;
  color: var(--ft-rubric);
}

.post-text {
  display: grid;
  gap: 2px;
}

.post-label {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.post-sub {
  font-size: 12px;
  font-style: italic;
  color: var(--ft-mute);
}

.post:hover .post-label,
.post:focus-visible .post-label {
  color: var(--ft-rubric);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

/* The text: a ruled folio, first character in red */

.folio {
  position: relative;
  padding: 22px 20px 14px;
  border-top: 1.5px solid var(--ft-ink);
  border-bottom: 1.5px solid var(--ft-ink);
  cursor: pointer;
  background: rgba(236, 226, 203, 0.94);
  box-shadow:
    0 -5px 0 -3.5px var(--ft-ink),
    0 5px 0 -3.5px var(--ft-ink);
}

@media (min-width: 640px) {
  .folio {
    padding: 24px 28px 16px;
  }
}

.speaker {
  position: absolute;
  top: 0;
  left: 20px;
  padding: 0 10px;
  font-size: 13px;
  letter-spacing: 0.4em;
  color: var(--ft-rubric);
  background: var(--ft-paper);
  transform: translateY(-50%);
}

.headline {
  margin: 0;
  font-family: var(--h-story);
  font-size: clamp(26px, 6.2vw, 52px);
  font-weight: 900;
  line-height: 1.3;
  letter-spacing: 0.04em;
  text-wrap: balance;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.headline :deep(.h-char:first-child) {
  color: var(--ft-rubric);
}

.adv-home[data-locale='en'] .headline {
  letter-spacing: 0;
}

.line {
  min-height: calc(1.85em * 3);
  margin: 10px 0 0;
  font-size: 16px;
  line-height: 1.85;
  color: #4a3b2c;
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

/* Ink lands as it would on paper: no blur, a short soak */
.ft :deep(.h-char) {
  animation-name: ft-ink;
}

.box-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.leaves {
  display: flex;
  gap: 8px;
  font-style: normal;
}

.leaves i {
  font-style: normal;
  color: rgba(42, 31, 22, 0.25);
}

.leaves i.is-read {
  color: var(--ft-ink);
}

.leaves i.is-here {
  color: var(--ft-rubric);
}

.next {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin: -8px -10px -10px 0;
  cursor: pointer;
}

.quill {
  font-size: 18px;
  color: var(--ft-rubric);
  animation: quill 1.4s ease-in-out infinite alternate;
}

/* Backlog */

.log {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: 28px;
  background: rgba(236, 226, 203, 0.97);
}

.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1.5px solid var(--ft-ink);
  font-size: 16px;
  letter-spacing: 0.4em;
  color: var(--ft-rubric);
}

.log-list {
  flex: 1;
  width: 100%;
  max-width: 44rem;
  margin: 16px auto 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.log-list li {
  padding: 14px 0;
  border-bottom: 1px solid rgba(42, 31, 22, 0.25);
}

.log-list p {
  margin: 0;
  line-height: 1.85;
}

.log-list .log-headline {
  font-size: 22px;
  font-weight: 900;
}

.ft :is(a, button):focus-visible {
  outline: 2px solid var(--ft-rubric);
  outline-offset: 3px;
}

@keyframes ft-ink {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes post-in {
  from {
    opacity: 0;
    clip-path: inset(0 0 0 100%);
  }
  to {
    opacity: 1;
    clip-path: inset(0 0 0 0);
  }
}

@keyframes quill {
  to {
    transform: translate(2px, -2px) rotate(-8deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .post,
  .quill {
    animation: none;
  }
}
</style>
