<script setup lang="ts">
import { useAdvStartActions, useGameConfig } from '@advjs/client'
import { computed } from 'vue'

const gameConfig = useGameConfig()
const actions = useAdvStartActions()

const observer = computed(() => gameConfig.value.characters.find(character => character.id === 'observer'))
const hamster = computed(() => gameConfig.value.characters.find(character => character.id === 'pet-hamster'))
const observerTachie = computed(() => observer.value?.tachies?.curious?.src || observer.value?.tachies?.default?.src)
const hamsterTachie = computed(() => hamster.value?.tachies?.default?.src)
</script>

<template>
  <main
    class="hamster-start"
    :style="{ '--hamster-cover': `url(${gameConfig.cover})` }"
  >
    <div class="hamster-start__backdrop" aria-hidden="true" />
    <div class="hamster-start__grain" aria-hidden="true" />

    <header class="hamster-start__meta">
      <span>ADV.JS · FEATURE DEMO</span>
      <span>CANON 01—19</span>
    </header>

    <section class="hamster-start__hero">
      <div class="hamster-orbit" aria-hidden="true">
        <span class="hamster-orbit__ring hamster-orbit__ring--outer" />
        <span class="hamster-orbit__ring hamster-orbit__ring--inner" />
        <span class="hamster-orbit__star" />
      </div>

      <p class="hamster-start__eyebrow">
        两篇小说 · 一次完整航行
      </p>
      <h1>
        <span>仓鼠</span>
        <small>星海回声</small>
      </h1>
      <p class="hamster-start__intro">
        从两米远的笼子出发，穿过被模拟的地球、仓人的文明与黯淡群星。
      </p>
      <div class="hamster-start__canon">
        <span>正史模式首次开放</span>
        <span>A+ 演绎将在通关后解锁</span>
      </div>
    </section>

    <div class="hamster-start__cast" aria-hidden="true">
      <img v-if="observerTachie" class="hamster-start__observer" :src="observerTachie">
      <div class="hamster-start__specimen">
        <span>SUBJECT 00</span>
        <img v-if="hamsterTachie" :src="hamsterTachie">
      </div>
    </div>

    <nav class="hamster-start__menu" aria-label="开始菜单">
      <button class="hamster-start__primary" type="button" @click="actions.startGame">
        <span class="hamster-start__play" aria-hidden="true">▶</span>
        <span>
          <b>开始观测</b>
          <small>从《仓鼠》进入正史主线</small>
        </span>
      </button>

      <div class="hamster-start__secondary">
        <button type="button" @click="actions.openLoadGame">
          读取记录
        </button>
        <button type="button" @click="actions.openFlowChart">
          章节星图
        </button>
        <button type="button" @click="actions.openSettings">
          设置
        </button>
        <RouterLink to="/credits">
          创作档案
        </RouterLink>
      </div>
    </nav>

    <footer class="hamster-start__footer">
      <span>YunYouJun《仓鼠》→《仓生》</span>
      <span>CC BY-NC-SA 4.0</span>
    </footer>

    <AdvGameModals />
  </main>
</template>

<route lang="yaml">
meta:
  layout: fullscreen
</route>

<style scoped lang="scss">
.hamster-start {
  --ink: #f3eee4;
  --muted: #aeb8ce;
  --amber: #f6c96b;
  --cyan: #75ddeb;
  --void: #070a12;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--void);
  color: var(--ink);
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  text-align: left;
}

.hamster-start__backdrop {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(
      90deg,
      rgb(7 10 18 / 96%) 0%,
      rgb(7 10 18 / 74%) 42%,
      rgb(7 10 18 / 20%) 68%,
      rgb(7 10 18 / 76%) 100%
    ),
    linear-gradient(0deg, rgb(7 10 18 / 88%), transparent 54%), var(--hamster-cover);
  background-position: center;
  background-size: cover;
  transform: scale(1.02);
  animation: cover-arrive 1.8s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.hamster-start__grain {
  position: absolute;
  inset: 0;
  opacity: 0.12;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.36'/%3E%3C/svg%3E");
  pointer-events: none;
  mix-blend-mode: soft-light;
}

.hamster-start__meta,
.hamster-start__footer {
  position: absolute;
  z-index: 4;
  right: clamp(1.25rem, 4vw, 4.5rem);
  left: clamp(1.25rem, 4vw, 4.5rem);
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: clamp(0.58rem, 0.75vw, 0.75rem);
  letter-spacing: 0.19em;
}

.hamster-start__meta {
  top: clamp(1.25rem, 4vh, 3.5rem);
}

.hamster-start__footer {
  bottom: clamp(1rem, 3vh, 2.5rem);
}

.hamster-start__hero {
  position: absolute;
  z-index: 3;
  top: 16%;
  left: clamp(1.5rem, 8vw, 9rem);
  width: min(37rem, 44vw);
  animation: copy-arrive 1s 0.25s both;
}

.hamster-start__eyebrow {
  margin: 0 0 1.1rem;
  color: var(--cyan);
  font-size: clamp(0.68rem, 0.9vw, 0.9rem);
  font-weight: 600;
  letter-spacing: 0.28em;
}

.hamster-start h1 {
  position: relative;
  margin: 0;
  font-family: 'Songti SC', STSong, 'Noto Serif CJK SC', serif;
  font-weight: 700;
  line-height: 0.88;
  letter-spacing: -0.06em;
  text-shadow: 0 0 3rem rgb(117 221 235 / 20%);
}

.hamster-start h1 > span {
  display: block;
  font-size: clamp(4.2rem, 9vw, 9rem);
}

.hamster-start h1 small {
  display: block;
  margin-top: 0.45em;
  padding-left: 0.15em;
  color: var(--amber);
  font-size: clamp(1.2rem, 2.6vw, 2.65rem);
  font-weight: 500;
  letter-spacing: 0.32em;
}

.hamster-start__intro {
  width: min(32rem, 100%);
  margin: clamp(1.6rem, 4vh, 3.25rem) 0 0;
  color: #d8deeb;
  font-family: 'Songti SC', STSong, serif;
  font-size: clamp(0.95rem, 1.25vw, 1.25rem);
  line-height: 1.85;
}

.hamster-start__canon {
  display: flex;
  gap: 0.7rem;
  margin-top: 1.4rem;
  flex-wrap: wrap;
}

.hamster-start__canon span {
  border: 1px solid rgb(174 184 206 / 30%);
  padding: 0.42rem 0.72rem;
  color: var(--muted);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}

.hamster-orbit {
  position: absolute;
  top: -8.5rem;
  left: -7.5rem;
  width: clamp(11rem, 20vw, 19rem);
  aspect-ratio: 1;
  opacity: 0.72;
  pointer-events: none;
}

.hamster-orbit__ring {
  position: absolute;
  inset: 0;
  border: 1px solid rgb(117 221 235 / 35%);
  border-right-color: var(--amber);
  border-radius: 50%;
  animation: orbit 18s linear infinite;
}

.hamster-orbit__ring--inner {
  inset: 23%;
  border-color: rgb(246 201 107 / 35%);
  border-left-color: var(--cyan);
  animation-direction: reverse;
  animation-duration: 11s;
}

.hamster-orbit__star {
  position: absolute;
  top: 48%;
  left: 48%;
  width: 0.65rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 1.5rem var(--amber);
}

.hamster-start__cast {
  position: absolute;
  z-index: 2;
  top: 2%;
  right: 8%;
  width: min(43vw, 43rem);
  height: 98%;
  pointer-events: none;
}

.hamster-start__observer {
  position: absolute;
  right: 2%;
  bottom: -7%;
  max-width: 94%;
  height: 104%;
  object-fit: contain;
  filter: drop-shadow(-1.8rem 0 2.5rem rgb(2 4 10 / 64%));
  animation: cast-arrive 1.2s 0.15s both;
}

.hamster-start__specimen {
  position: absolute;
  right: -1rem;
  bottom: 7%;
  width: clamp(5.5rem, 9vw, 8.5rem);
  border: 1px solid rgb(117 221 235 / 38%);
  background: rgb(7 10 18 / 72%);
  padding: 0.55rem;
  backdrop-filter: blur(0.8rem);
}

.hamster-start__specimen span {
  display: block;
  color: var(--cyan);
  font-family: monospace;
  font-size: 0.52rem;
  letter-spacing: 0.14em;
}

.hamster-start__specimen img {
  display: block;
  width: 100%;
  height: 5.6rem;
  object-fit: contain;
}

.hamster-start__menu {
  position: absolute;
  z-index: 5;
  right: clamp(1.5rem, 6vw, 6.5rem);
  bottom: clamp(4rem, 10vh, 7rem);
  width: min(27rem, 34vw);
  animation: menu-arrive 0.9s 0.5s both;
}

.hamster-start__primary {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 1.2rem;
  border: 1px solid rgb(246 201 107 / 75%);
  background: linear-gradient(100deg, rgb(246 201 107 / 17%), rgb(7 10 18 / 76%) 72%);
  padding: 1.1rem 1.3rem;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  backdrop-filter: blur(1rem);
  transition:
    border-color 180ms ease,
    background 180ms ease,
    transform 180ms ease;
}

.hamster-start__primary:hover,
.hamster-start__primary:focus-visible {
  border-color: var(--amber);
  background: linear-gradient(100deg, rgb(246 201 107 / 28%), rgb(7 10 18 / 88%) 72%);
  outline: none;
  transform: translateX(-0.4rem);
}

.hamster-start__play {
  display: grid;
  width: 2.7rem;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid var(--amber);
  border-radius: 50%;
  color: var(--amber);
  font-size: 0.85rem;
}

.hamster-start__primary b,
.hamster-start__primary small {
  display: block;
}

.hamster-start__primary b {
  font-family: 'Songti SC', STSong, serif;
  font-size: clamp(1.1rem, 1.55vw, 1.5rem);
  letter-spacing: 0.12em;
}

.hamster-start__primary small {
  margin-top: 0.35rem;
  color: var(--muted);
  font-size: 0.68rem;
  letter-spacing: 0.09em;
}

.hamster-start__secondary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  margin-top: 0.8rem;
  gap: 1px;
  background: rgb(174 184 206 / 18%);
}

.hamster-start__secondary button,
.hamster-start__secondary a {
  border: 0;
  background: rgb(7 10 18 / 82%);
  padding: 0.82rem 1rem;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.76rem;
  letter-spacing: 0.12em;
  text-align: center;
  text-decoration: none;
  transition:
    color 160ms ease,
    background 160ms ease;
}

.hamster-start__secondary button:hover,
.hamster-start__secondary button:focus-visible,
.hamster-start__secondary a:hover,
.hamster-start__secondary a:focus-visible {
  background: rgb(18 27 58 / 94%);
  color: var(--cyan);
  outline: 1px solid rgb(117 221 235 / 42%);
}

@keyframes cover-arrive {
  from {
    opacity: 0;
    transform: scale(1.08);
  }
  to {
    opacity: 1;
    transform: scale(1.02);
  }
}

@keyframes copy-arrive {
  from {
    opacity: 0;
    transform: translateX(-1.5rem);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes cast-arrive {
  from {
    opacity: 0;
    transform: translateX(2rem);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes menu-arrive {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes orbit {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 800px) {
  .hamster-start__meta span:last-child,
  .hamster-start__footer span:last-child,
  .hamster-start__specimen {
    display: none;
  }

  .hamster-start__backdrop {
    background-image:
      linear-gradient(0deg, rgb(7 10 18 / 98%) 0%, rgb(7 10 18 / 42%) 72%, rgb(7 10 18 / 66%) 100%),
      var(--hamster-cover);
    background-position: 62% center;
  }

  .hamster-start__hero {
    top: 9%;
    left: 1.4rem;
    width: calc(100% - 2.8rem);
  }

  .hamster-start h1 > span {
    font-size: clamp(3.7rem, 20vw, 6rem);
  }
  .hamster-start h1 small {
    font-size: clamp(1.05rem, 6vw, 1.7rem);
  }
  .hamster-start__intro {
    width: 88%;
    font-size: 0.9rem;
  }
  .hamster-start__canon span:last-child {
    display: none;
  }

  .hamster-start__cast {
    top: 20%;
    right: -14%;
    width: 78%;
    height: 58%;
    opacity: 0.7;
  }

  .hamster-start__menu {
    right: 1.35rem;
    bottom: 3.7rem;
    left: 1.35rem;
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hamster-start *,
  .hamster-start *::before,
  .hamster-start *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
