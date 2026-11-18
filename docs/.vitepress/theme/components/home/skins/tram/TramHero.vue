<script setup lang="ts">
import { computed } from 'vue'
import { useHero } from '../../../../composables/hero'
import { useParallax } from '../../../../composables/home'
import { useHomeSkin } from '../../../../composables/skin'
import HomeCity from '../../HomeCity.vue'
import HomeTypewriter from '../../HomeTypewriter.vue'

/** Line colours of the transfer signs. */
const SIGNS = ['var(--h-enamel)', '#2f6fb5', '#b5531f']

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

// Depth through the glass: the far skyline barely moves, the lamps and the straps move most.
useParallax(stage)

// Leaving for another skin, the board announces the transfer.
const { phase, incoming } = useHomeSkin()
const destination = computed(() => phase.value === 'exit' && incoming.value
  ? t.value.hero.nextStop(t.value.skins[incoming.value].name)
  : t.value.hero.destination)
</script>

<template>
  <div
    ref="stage"
    class="stage h-car"
    :class="{ 'is-still': !inView }"
    :style="{ '--choices-delay': `${headDuration + 200}ms` }"
  >
    <!-- The car: windows onto the moving city, hand straps above -->
    <div class="scenery" aria-hidden="true">
      <div class="windows">
        <HomeCity />
        <div class="glass" />
        <i class="pillar" style="left: 34%" />
        <i class="pillar" style="left: 68%" />
      </div>
      <div class="straps">
        <span v-for="i in 9" :key="i" class="strap" :style="{ '--n': i }"><i /></span>
      </div>
    </div>

    <!-- Game UI -->
    <div class="ui">
      <div class="ui-top">
        <p class="route">
          <span class="h-roundel route-no">7</span>
          <span class="route-name">{{ t.hero.route }}</span>
        </p>
        <div class="destination h-led-board" aria-hidden="true">
          <div class="marquee">
            <span class="h-led-dots">{{ destination }}</span>
            <span class="h-led-dots">{{ destination }}</span>
          </div>
        </div>
        <div class="quick-menu">
          <button type="button" class="h-chip" :aria-pressed="auto" @click="auto = !auto">
            {{ t.ui.auto }}
          </button>
          <button ref="logButton" type="button" class="h-chip" @click="openLog">
            {{ t.hero.log }}
          </button>
        </div>
      </div>

      <nav class="ui-mid" :aria-label="t.hero.menu">
        <span class="transfer" aria-hidden="true">{{ t.hero.transfer }}</span>
        <a
          v-for="(choice, i) in choices"
          :key="choice.link"
          class="h-sign choice"
          :style="{ '--n': i, '--sign': SIGNS[i] }"
          :href="choice.link"
          :target="choice.external ? '_blank' : undefined"
          :rel="choice.external ? 'noreferrer' : undefined"
        >
          <span class="h-roundel" aria-hidden="true">{{ i + 1 }}</span>
          <span class="h-sign-text">
            <span class="h-sign-label">{{ choice.label }}</span>
            <span class="h-sign-sub">{{ choice.sub }}</span>
          </span>
          <span class="h-sign-arrow i-ri-arrow-right-line" aria-hidden="true" />
        </a>
      </nav>

      <div class="h-led-board dialogue" @click="advance">
        <span class="h-plate">ADV.JS</span>
        <HomeTypewriter
          as="h1"
          class="headline h-led-dots"
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
          <span class="stops" aria-hidden="true">
            <i v-for="(_, i) in lines" :key="i" :class="{ 'is-passed': i < index, 'is-here': i === index }" />
          </span>
          <button
            type="button"
            class="next"
            :aria-label="lineDone ? t.ui.next : t.ui.reveal"
            @click.stop="advance"
          >
            <span v-show="lineDone" class="h-next" />
          </button>
        </div>
      </div>
    </div>

    <!-- Backlog -->
    <div
      v-if="logOpen"
      class="log"
      role="dialog"
      aria-modal="true"
      :aria-label="t.hero.logLabel"
    >
      <div class="log-head">
        <span>{{ t.hero.log }}</span>
        <button ref="logClose" type="button" class="h-chip" @click="closeLog">
          {{ t.hero.close }}
        </button>
      </div>
      <ol class="log-list">
        <li>
          <span class="h-plate">ADV.JS</span>
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
.stage {
  --h-radius: 20px;
  --windows-top: 156px;
  --windows-bottom: 52%;
  display: flex;
  min-height: max(660px, calc(100svh - var(--vp-nav-height) - var(--h-switcher) - 24px));
}

@media (min-width: 640px) {
  .stage {
    --windows-top: 96px;
    --windows-bottom: 46%;
  }
}

@media (min-width: 960px) {
  .stage {
    --h-radius: 28px;
    --windows-top: 104px;
    --windows-bottom: 40%;
    min-height: 0;
    height: clamp(620px, calc(100svh - var(--vp-nav-height) - var(--h-switcher) - 32px), 860px);
  }
}

/* The car */

.scenery {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.windows {
  position: absolute;
  top: var(--windows-top);
  bottom: var(--windows-bottom);
  left: 16px;
  right: 16px;
  overflow: hidden;
  border-radius: 22px;
  background: var(--h-sky);
}

/* Frame drawn above the city */
.windows::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 10px #1a211e,
    inset 0 0 0 11px rgba(255, 255, 255, 0.06),
    inset 0 -40px 60px -30px rgba(0, 0, 0, 0.5);
}

@media (min-width: 960px) {
  .windows {
    left: 28px;
    right: 28px;
  }
}

.glass {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    112deg,
    rgba(255, 255, 255, 0.07) 0%,
    transparent 24%,
    transparent 60%,
    rgba(255, 255, 255, 0.04) 72%,
    transparent 84%
  );
}

.pillar {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14px;
  margin-left: -7px;
  background: linear-gradient(90deg, #121815, #222b27 50%, #121815);
}

.straps {
  position: absolute;
  top: calc(var(--windows-top) - 18px);
  left: 6%;
  right: 6%;
  display: flex;
  justify-content: space-between;
}

.strap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 4px;
  height: 34px;
  background: #2a332f;
  transform-origin: top center;
  animation: sway 3.6s ease-in-out infinite alternate;
  animation-delay: calc(var(--n) * -0.35s);
  animation-play-state: var(--drive, running);
}

.strap i {
  flex: none;
  width: 22px;
  height: 22px;
  margin-top: 30px;
  box-sizing: border-box;
  border: 4px solid #2a332f;
  border-radius: 50%;
}

.stage.is-still {
  --drive: paused;
}

@media (max-width: 639px) {
  .strap:nth-child(n + 6) {
    display: none;
  }
}

/* Depth, from the far skyline to the straps overhead (see useParallax) */
.windows :deep(.track.far) {
  translate: calc(var(--px, 0) * -3px) calc(var(--py, 0) * -2px);
}

.windows :deep(.track.near) {
  translate: calc(var(--px, 0) * -7px) calc(var(--py, 0) * -3px);
}

.windows :deep(.track.lamps) {
  translate: calc(var(--px, 0) * -10px) calc(var(--py, 0) * -4px);
}

.pillar {
  translate: calc(var(--px, 0) * 4px) 0;
}

.straps {
  translate: calc(var(--px, 0) * 12px) calc(var(--py, 0) * 4px);
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

.ui-top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    'route menu'
    'dest dest';
  gap: 12px 16px;
  align-items: center;
}

@media (min-width: 640px) {
  .ui-top {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'route dest menu';
  }
}

.route {
  grid-area: route;
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 0;
}

.route-no {
  width: 44px;
  height: 44px;
  font-size: 22px;
  color: #fff;
  background: var(--h-enamel);
  box-shadow:
    inset 0 0 0 2px var(--h-enamel),
    inset 0 0 0 3.5px var(--h-enamel-rule);
}

.route-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #e9efeb;
}

.destination {
  grid-area: dest;
  height: 52px;
  overflow: hidden;
  border-radius: 10px;
}

.marquee {
  display: flex;
  width: max-content;
  padding-top: 7px;
  animation: marquee 30s linear infinite;
  animation-play-state: var(--drive, running);
}

.marquee span {
  padding: 0 6em 0 2em;
  font-family: var(--h-story);
  font-size: 30px;
  font-weight: 900;
  line-height: 38px;
  white-space: nowrap;
}

.quick-menu {
  grid-area: menu;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.ui-mid {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
  justify-content: center;
  width: min(100%, 320px);
  margin: 0 auto;
  padding: 36px 0 28px;
}

@media (min-width: 960px) {
  .ui-mid {
    margin-right: 5%;
  }
}

.transfer {
  padding-left: 2px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3em;
  color: #a9bbb2;
}

.choice {
  animation: choice-in 0.6s var(--h-ease) both;
  animation-delay: calc(var(--choices-delay) + var(--n) * 90ms);
}

.choice:hover,
.choice:focus-visible {
  transform: translateX(4px);
}

/* Dialogue: the LED board */

.dialogue {
  padding: 30px 20px 18px;
  cursor: pointer;
}

.dialogue > .h-plate {
  position: absolute;
  top: 0;
  left: 18px;
  transform: translateY(-50%);
}

@media (min-width: 640px) {
  .dialogue {
    padding: 32px 30px 20px;
  }
}

.headline {
  margin: 0;
  font-family: var(--h-story);
  font-size: clamp(26px, 6.8vw, 56px);
  font-weight: 900;
  line-height: 1.3;
  letter-spacing: 0.04em;
  text-wrap: balance;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.adv-home[data-locale='en'] .headline {
  letter-spacing: 0;
}

.line {
  min-height: calc(1.85em * 3);
  margin: 12px 0 0;
  font-size: 16px;
  line-height: 1.85;
  color: #f3dcb4;
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
    font-size: 18px;
  }
}

.box-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

/* Progress, drawn as stops on the line */
.stops {
  position: relative;
  display: flex;
  gap: 22px;
  align-items: center;
}

.stops::before {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  height: 2px;
  background: rgba(255, 177, 59, 0.3);
}

.stops i {
  position: relative;
  width: 8px;
  height: 8px;
  box-sizing: border-box;
  border: 2px solid rgba(255, 177, 59, 0.55);
  border-radius: 50%;
  background: var(--h-led-off);
}

.stops i.is-passed {
  background: rgba(255, 177, 59, 0.55);
}

.stops i.is-here {
  border-color: var(--h-led);
  background: var(--h-led);
  box-shadow: 0 0 8px var(--h-led);
}

.next {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin: -8px -10px -10px 0;
  border-radius: 8px;
  cursor: pointer;
}

.next .h-next {
  border-color: var(--h-led);
  filter: drop-shadow(0 0 6px var(--h-led-glow));
}

/* Backlog */

.log {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: rgba(10, 14, 12, 0.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: log-in 0.3s var(--h-ease) both;
}

.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: #fff;
}

.log-list {
  flex: 1;
  max-width: 44rem;
  margin: 24px auto 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.log-list li {
  padding: 18px 0;
  border-bottom: 1px solid var(--h-car-line);
}

.log-list p {
  margin: 10px 0 0;
  line-height: 1.85;
  color: #f3dcb4;
}

.log-list .log-headline {
  font-family: var(--h-story);
  font-size: 22px;
  font-weight: 900;
  color: var(--h-led);
}

@keyframes marquee {
  to {
    transform: translateX(-50%);
  }
}

@keyframes sway {
  from {
    transform: rotate(-4deg);
  }
  to {
    transform: rotate(4deg);
  }
}

@keyframes choice-in {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
}

@keyframes log-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .strap,
  .marquee,
  .choice,
  .log {
    animation: none;
  }
}
</style>
