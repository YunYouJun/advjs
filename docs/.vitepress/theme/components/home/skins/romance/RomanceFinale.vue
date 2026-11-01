<script setup lang="ts">
import { useFinale } from '../../../../composables/hero'
import HomeTypewriter from '../../HomeTypewriter.vue'

const { t, choices, root, plays } = useFinale()

const TILT = [-1.6, 1.2, -0.6]
</script>

<template>
  <!-- The school roof at dusk: the last scene, and 完 -->
  <div ref="root" class="finale rm">
    <svg class="sky" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <rect width="1200" height="520" fill="#f6c49a" />
      <rect y="150" width="1200" height="120" fill="#eda88a" />
      <rect y="270" width="1200" height="90" fill="#c98f97" />
      <rect y="360" width="1200" height="160" fill="#8a7a9c" />
      <circle cx="860" cy="330" r="64" fill="#ffe7c7" />
      <path d="M0 520V420h90v-30h60v40h50v-60h70v50h40v-24h80v44h60v-70h56v66h44v-30h80v42h60v-56h70v48h40v-20h90v40h60v-60h70v52h80v58z" fill="#6c5d82" />
      <!-- Rooftop fence -->
      <g stroke="#4f4263" stroke-width="5">
        <path d="M0 440H1200M0 470H1200" />
        <path v-for="n in 31" :key="n" :d="`M${(n - 1) * 40} 400V520`" />
      </g>
      <rect y="400" width="1200" height="8" fill="#4f4263" />
    </svg>

    <span class="stamp" aria-hidden="true">{{ t.finale.theEnd }}</span>

    <div class="box">
      <span class="name">ADV.JS</span>
      <HomeTypewriter
        :key="plays"
        as="p"
        class="line"
        :text="t.finale.line"
        :speed="80"
        :instant="plays === 0"
      />
    </div>

    <nav class="notes" :aria-label="t.finale.menu">
      <a
        v-for="(choice, i) in choices"
        :key="choice.link"
        class="note"
        :class="{ 'is-primary': choice.primary }"
        :style="{ '--tilt': `${TILT[i]}deg` }"
        :href="choice.link"
        :target="choice.external ? '_blank' : undefined"
        :rel="choice.external ? 'noreferrer' : undefined"
      >
        <span class="note-label">{{ choice.label }}</span>
        <span class="note-sub">{{ choice.sub }}</span>
      </a>
    </nav>
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
  display: grid;
  gap: 32px;
  align-items: center;
  padding: 72px 20px 48px;
  overflow: hidden;
  border-radius: 24px;
  font-family: var(--rm-round);
  color: var(--rm-ink);
  background: #f6c49a;
}

@media (min-width: 960px) {
  .rm {
    grid-template-columns: minmax(0, 1fr) 290px;
    gap: 56px;
    padding: 96px 64px 80px;
  }
}

.sky {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
}

/* 完, pressed in like a seal on the last page */
.stamp {
  position: absolute;
  top: 20px;
  right: 20px;
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  font-family: var(--h-story);
  font-size: 24px;
  font-weight: 900;
  color: #fff;
  background: var(--rm-rose);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.7);
  transform: rotate(-8deg);
}

.box {
  position: relative;
  padding: 32px 24px 26px;
  border-radius: 22px;
  background: rgba(255, 253, 249, 0.95);
  box-shadow:
    0 0 0 3px #fff,
    0 0 0 5px var(--rm-line);
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

.line {
  margin: 0;
  font-family: var(--rm-round);
  font-size: clamp(22px, 3.2vw, 34px);
  font-weight: 800;
  line-height: 1.5;
  letter-spacing: 0.04em;
}

.adv-home[data-locale='en'] .line {
  letter-spacing: 0;
  text-wrap: balance;
}

.notes {
  display: grid;
  gap: 16px;
}

.note {
  position: relative;
  display: grid;
  gap: 4px;
  padding: 16px 18px 12px;
  color: var(--rm-ink);
  text-decoration: none;
  background: var(--rm-note);
  box-shadow: 0 6px 12px -4px rgba(80, 50, 60, 0.35);
  transform: rotate(var(--tilt));
  transition: transform 0.25s var(--h-ease);
}

.note.is-primary {
  background: #fff;
  box-shadow:
    inset 0 0 0 2px var(--rm-rose),
    0 6px 12px -4px rgba(80, 50, 60, 0.35);
}

.note::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  width: 56px;
  height: 16px;
  margin-left: -28px;
  background: rgba(217, 79, 106, 0.3);
}

.note:hover,
.note:focus-visible {
  transform: rotate(0deg) translateY(-3px);
}

.note-label {
  font-size: 16px;
  font-weight: 800;
}

.note-sub {
  font-size: 11px;
  color: var(--rm-rose);
}

.rm :is(a, button):focus-visible {
  outline: 2px solid var(--rm-rose);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .note {
    transition: none;
  }
}
</style>
