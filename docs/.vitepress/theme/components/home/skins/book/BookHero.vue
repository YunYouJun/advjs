<script setup lang="ts">
import { computed } from 'vue'
import { useHero } from '../../../../composables/hero'
import { useParallax } from '../../../../composables/home'
import HomeTypewriter from '../../HomeTypewriter.vue'
import BookArt from './BookArt.vue'

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

/** Each line of the pitch gets its own plate. */
const PLATES = ['wheel', 'seed', 'night']
const plate = computed(() => PLATES[index.value % PLATES.length])

const TABS = ['#e86a4f', '#7fb3a6', '#f2b45a']
</script>

<template>
  <div ref="stage" class="stage bk" :class="{ 'is-still': !inView }">
    <div class="quick-menu">
      <button type="button" class="bk-btn" :aria-pressed="auto" @click="auto = !auto">
        {{ t.ui.auto }}
      </button>
      <button ref="logButton" type="button" class="bk-btn" @click="openLog">
        {{ t.hero.log }}
      </button>
    </div>

    <div class="book">
      <!-- Left page: the plate -->
      <div class="page left" aria-hidden="true">
        <Transition name="plate" mode="out-in">
          <BookArt :key="plate" class="plate" :scene="plate" />
        </Transition>
        <span class="folio">{{ t.hero.book.page(index * 2 + 2) }}</span>
      </div>

      <!-- Right page: the words -->
      <div class="page right" @click="advance">
        <p class="byline">
          <span>{{ t.hero.book.title }}</span>
          <span>{{ t.hero.book.byline }}</span>
        </p>
        <HomeTypewriter
          as="h1"
          class="headline"
          :text="t.hero.headline"
          :speed="HEAD_SPEED"
          :instant="headInstant"
          @done="headInstant = true"
        />
        <Transition name="leaf" mode="out-in">
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
        </Transition>
        <span class="folio">{{ t.hero.book.page(index * 2 + 3) }}</span>
        <button
          type="button"
          class="corner"
          :aria-label="lineDone ? t.ui.next : t.ui.reveal"
          @click.stop="advance"
        >
          <span v-show="lineDone" class="curl" />
        </button>
      </div>

      <!-- Bookmarks, sticking out of the fore-edge -->
      <nav class="tabs" :aria-label="t.hero.menu">
        <a
          v-for="(choice, i) in choices"
          :key="choice.link"
          class="tab"
          :style="{ '--tab': TABS[i], '--n': i }"
          :href="choice.link"
          :target="choice.external ? '_blank' : undefined"
          :rel="choice.external ? 'noreferrer' : undefined"
        >
          <span class="tab-label">{{ choice.label }}</span>
          <span class="tab-sub">{{ choice.sub }}</span>
        </a>
      </nav>
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
        <button ref="logClose" type="button" class="bk-btn" @click="closeLog">
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
.bk {
  --bk-paper: #fbf6ea;
  --bk-ink: #3c2f22;
  --bk-mute: #a08d72;
  --bk-desk: #d9cdb4;
  --bk-kai: 'Kaiti SC', 'STKaiti', 'KaiTi', 'BiauKai', var(--h-story);
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: max(660px, calc(100svh - var(--vp-nav-height) - var(--h-switcher) - 24px));
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 18px;
  font-family: var(--bk-kai);
  color: var(--bk-ink);
  background: var(--bk-desk);
}

@media (min-width: 960px) {
  .bk {
    min-height: 0;
    height: clamp(620px, calc(100svh - var(--vp-nav-height) - var(--h-switcher) - 32px), 860px);
    padding: 28px 32px 32px;
  }
}

.stage.is-still {
  --drive: paused;
}

.quick-menu {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-bottom: 14px;
}

/* Buttons drawn with a wobbly pen */
.bk-btn {
  height: 34px;
  padding: 0 16px;
  border: 2px solid var(--bk-ink);
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
  font-family: var(--bk-kai);
  font-size: 15px;
  color: var(--bk-ink);
  cursor: pointer;
  background: var(--bk-paper);
}

.bk-btn[aria-pressed='true'] {
  background: #fde7c2;
}

.bk-btn[aria-pressed]::before {
  content: '○ ';
}

.bk-btn[aria-pressed='true']::before {
  content: '● ';
  color: #e86a4f;
}

/* The open book */

.book {
  position: relative;
  display: grid;
  flex: 1;
  grid-template-rows: auto auto 1fr;
  min-height: 0;
}

@media (min-width: 960px) {
  .book {
    grid-template-columns: 1fr 1fr 190px;
    grid-template-rows: none;
  }
}

.page {
  position: relative;
  box-sizing: border-box;
  background: var(--bk-paper);
}

.left {
  aspect-ratio: 520 / 300;
  padding: 14px;
  border-radius: 14px 14px 0 0;
  box-shadow: 0 4px 0 -1px #cbbd9f;
}

.right {
  display: flex;
  flex-direction: column;
  padding: 22px 22px 44px;
  border-radius: 0 0 14px 14px;
  cursor: pointer;
  box-shadow: 0 6px 0 -2px #cbbd9f;
}

@media (min-width: 960px) {
  .left {
    display: flex;
    flex-direction: column;
    justify-content: center;
    aspect-ratio: auto;
    padding: 36px 28px 48px;
    border-radius: 6px 0 0 6px;
    /* the gutter: a crease and the page behind */
    box-shadow:
      inset -1px 0 0 #e6dac2,
      inset -10px 0 0 -8px #efe5d0,
      -6px 0 0 -3px #efe6d2,
      0 6px 0 -2px #cbbd9f;
  }

  .right {
    justify-content: center;
    padding: 40px 44px 56px;
    border-radius: 0 6px 6px 0;
    box-shadow:
      inset 1px 0 0 #e6dac2,
      6px 0 0 -3px #efe6d2,
      0 6px 0 -2px #cbbd9f;
  }
}

.plate {
  width: 100%;
  height: 100%;
}

.plate-enter-active,
.plate-leave-active {
  transition: opacity 0.45s ease;
}

.plate-enter-from,
.plate-leave-to {
  opacity: 0;
}

.folio {
  position: absolute;
  bottom: 14px;
  left: 0;
  right: 0;
  font-size: 13px;
  letter-spacing: 0.2em;
  text-align: center;
  color: var(--bk-mute);
}

.left .folio {
  display: none;
}

@media (min-width: 960px) {
  .left .folio {
    display: block;
  }
}

.byline {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  justify-content: space-between;
  margin: 0 0 18px;
  padding-bottom: 10px;
  border-bottom: 1.5px dashed #e3d6bb;
  font-size: 14px;
  color: var(--bk-mute);
}

.headline {
  margin: 0;
  font-family: var(--bk-kai);
  font-size: clamp(28px, 4.4vw, 46px);
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.02em;
  text-wrap: balance;
  line-break: strict;
}

.adv-home[data-locale='en'] .headline {
  font-family: var(--h-story);
  letter-spacing: 0;
}

.line {
  min-height: calc(1.9em * 3);
  margin: 16px 0 0;
  font-size: 18px;
  line-height: 1.9;
  color: #5a4a3a;
}

@media (min-width: 960px) {
  .line {
    font-size: 19px;
  }
}

.leaf-enter-active,
.leaf-leave-active {
  transition:
    opacity 0.35s ease,
    clip-path 0.45s var(--h-ease);
}

.leaf-enter-from {
  opacity: 0;
  clip-path: inset(0 0 0 100%);
}

.leaf-leave-to {
  opacity: 0;
}

/* Turn the page: the corner lifts */
.corner {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 44px;
  height: 44px;
  cursor: pointer;
}

.curl {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 28px;
  height: 28px;
  border-radius: 0 0 6px 0;
  background: linear-gradient(135deg, transparent 50%, #e8dcc2 50%);
  box-shadow: -2px -2px 0 -1px rgba(60, 47, 34, 0.12);
  animation: curl 1.4s ease-in-out infinite alternate;
}

/* Bookmarks */

.tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 18px;
}

@media (min-width: 960px) {
  .tabs {
    grid-template-columns: none;
    align-content: center;
    gap: 14px;
    margin: 0 0 0 -6px;
  }
}

.tab {
  display: grid;
  gap: 2px;
  padding: 12px 12px 10px;
  border-radius: 4px 14px 14px 4px;
  color: var(--bk-ink);
  text-decoration: none;
  background: var(--tab);
  box-shadow: 0 3px 0 rgba(60, 47, 34, 0.18);
  transition: transform 0.25s var(--h-ease);
}

@media (min-width: 960px) {
  .tab {
    padding: 14px 16px 12px 20px;
    animation: tab-in 0.6s var(--h-ease) both;
    animation-delay: calc(0.6s + var(--n) * 0.12s);
  }

  .tab:hover,
  .tab:focus-visible {
    transform: translateX(8px);
  }
}

.tab-label {
  font-size: 17px;
  font-weight: 700;
}

.tab-sub {
  overflow: hidden;
  font-family: var(--h-system);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0.75;
}

/* Backlog */

.log {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: 28px;
  background: rgba(251, 246, 234, 0.98);
}

.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 20px;
}

.log-list {
  flex: 1;
  width: 100%;
  max-width: 40rem;
  margin: 20px auto 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.log-list li {
  padding: 14px 0;
  border-bottom: 1.5px dashed #e3d6bb;
}

.log-list p {
  margin: 0;
  font-size: 17px;
  line-height: 1.9;
}

.log-list .log-headline {
  font-size: 24px;
  font-weight: 700;
}

.bk :is(a, button):focus-visible {
  outline: 2px dashed #e86a4f;
  outline-offset: 3px;
}

@keyframes curl {
  to {
    width: 34px;
    height: 34px;
  }
}

@keyframes tab-in {
  from {
    opacity: 0;
    transform: translateX(-24px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .curl,
  .tab {
    animation: none;
  }

  .plate-enter-active,
  .plate-leave-active,
  .leaf-enter-active,
  .leaf-leave-active,
  .tab {
    transition: none;
  }
}
</style>
