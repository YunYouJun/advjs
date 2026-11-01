<script setup lang="ts">
import { useFinale } from '../../../../composables/hero'
import HomeTypewriter from '../../HomeTypewriter.vue'

const { t, choices, root, plays } = useFinale()

const NUMERALS = ['Ⅰ', 'Ⅱ', 'Ⅲ']
</script>

<template>
  <!-- The edge of the map: the ink runs out, and a seal closes the atlas -->
  <div ref="root" class="finale ft">
    <svg class="edge" viewBox="0 0 1200 420" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <path class="hatch" d="M860 0 C 830 80, 880 160, 840 240 S 870 360, 850 420" />
      <g class="ink">
        <path v-for="n in 14" :key="n" :d="`M${780 + (n % 3) * 18} ${n * 30} l 40 -10`" />
      </g>
      <text x="1010" y="210" class="unmapped" transform="rotate(90 1010 210)" text-anchor="middle">{{ t.finale.unmapped }}</text>
    </svg>

    <span class="seal" aria-hidden="true">{{ t.finale.theEnd }}</span>

    <div class="folio">
      <HomeTypewriter
        :key="plays"
        as="p"
        class="line"
        :text="t.finale.line"
        :speed="90"
        :instant="plays === 0"
      />
    </div>

    <nav class="posts" :aria-label="t.finale.menu">
      <a
        v-for="(choice, i) in choices"
        :key="choice.link"
        class="post"
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
  display: grid;
  gap: 32px;
  align-items: center;
  padding: 64px 20px 48px;
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
    grid-template-columns: minmax(0, 1fr) 300px 120px;
    gap: 48px;
    padding: 88px 40px 80px 64px;
  }
}

.edge {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  opacity: 0.4;
}

@media (min-width: 960px) {
  .edge {
    opacity: 1;
  }
}

.hatch {
  fill: none;
  stroke: var(--ft-ink);
  stroke-width: 1.4;
  stroke-dasharray: 3 9;
}

.ink path {
  stroke: var(--ft-ink);
  stroke-width: 1;
  opacity: 0.5;
}

.unmapped {
  font-family: var(--h-story);
  font-size: 22px;
  font-style: italic;
  letter-spacing: 0.5em;
  fill: var(--ft-mute);
}

.adv-home[data-locale='en'] .unmapped {
  letter-spacing: 0.1em;
}

/* A wax seal, pressed on the last leaf */
.seal {
  position: absolute;
  top: 22px;
  right: 22px;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  font-size: 22px;
  font-weight: 900;
  color: #f3e6c8;
  background: var(--ft-rubric);
  box-shadow:
    inset 0 0 0 3px #8c2914,
    inset 0 0 0 4.5px rgba(243, 230, 200, 0.5),
    0 2px 0 #6b1d0d;
  transform: rotate(-10deg);
}

.folio {
  padding: 24px 4px 22px;
  border-top: 1.5px solid var(--ft-ink);
  border-bottom: 1.5px solid var(--ft-ink);
  box-shadow:
    0 -5px 0 -3.5px var(--ft-ink),
    0 5px 0 -3.5px var(--ft-ink);
}

.line {
  margin: 0;
  font-size: clamp(24px, 3.4vw, 38px);
  font-weight: 900;
  line-height: 1.5;
  letter-spacing: 0.04em;
}

.line :deep(.h-char:first-child) {
  color: var(--ft-rubric);
}

.adv-home[data-locale='en'] .line {
  letter-spacing: 0;
  text-wrap: balance;
}

.posts {
  display: grid;
  border-top: 1.5px solid var(--ft-ink);
  border-bottom: 1.5px solid var(--ft-ink);
  background: rgba(236, 226, 203, 0.9);
}

.post {
  display: flex;
  gap: 14px;
  align-items: baseline;
  padding: 12px 6px 10px;
  color: var(--ft-ink);
  text-decoration: none;
}

.post + .post {
  border-top: 1px solid rgba(42, 31, 22, 0.35);
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

.ft :is(a, button):focus-visible {
  outline: 2px solid var(--ft-rubric);
  outline-offset: 3px;
}
</style>
