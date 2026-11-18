<script setup lang="ts">
import { useFinale } from '../../../../composables/hero'
import { createRandom } from '../../../../composables/home'
import HomeTypewriter from '../../HomeTypewriter.vue'

const { t, choices, root, plays } = useFinale()

const random = createRandom(1013)
const stars = Array.from({ length: 40 }, () => ({
  x: Math.round(random() * 1000),
  y: Math.round(random() * 260),
  r: random() > 0.85 ? 1.6 : 0.9,
}))

const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <!-- End of transmission: the planet's limb at the bottom of the frame -->
  <div ref="root" class="finale sf">
    <svg class="sky" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <circle v-for="(s, i) in stars" :key="i" class="star" :cx="s.x" :cy="s.y" :r="s.r" />
      <path class="limb" d="M-100 400 Q500 210 1100 400" />
      <path class="limb-glow" d="M-100 412 Q500 222 1100 412" />
    </svg>

    <div class="log">
      <p class="who">
        <b>{{ t.finale.signalEnd }}</b>
        <span>LOG 0427-END</span>
      </p>
      <HomeTypewriter
        :key="plays"
        as="p"
        class="line"
        :text="t.finale.line"
        :speed="70"
        :instant="plays === 0"
      />
    </div>

    <nav class="menu" :aria-label="t.finale.menu">
      <a
        v-for="(choice, i) in choices"
        :key="choice.link"
        class="cmd"
        :class="{ 'is-primary': choice.primary }"
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
  display: grid;
  gap: 28px;
  align-items: center;
  padding: 56px 20px 120px;
  overflow: hidden;
  border-radius: 6px;
  color: var(--sf-ink);
  background: var(--sf-bg);
  box-shadow: inset 0 0 0 1px var(--sf-rule);
}

@media (min-width: 960px) {
  .sf {
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 48px;
    padding: 80px 64px 150px;
  }
}

.sky {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
}

.star {
  fill: var(--sf-ink);
  opacity: 0.5;
}

.limb {
  fill: #111314;
  stroke: var(--sf-ink);
  stroke-opacity: 0.6;
  vector-effect: non-scaling-stroke;
}

.limb-glow {
  fill: none;
  stroke: var(--sf-signal);
  stroke-opacity: 0.5;
  stroke-dasharray: 2 6;
  vector-effect: non-scaling-stroke;
}

.who {
  display: flex;
  gap: 16px;
  margin: 0 0 16px;
  font-family: var(--h-mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--sf-mute);
}

.who b {
  padding: 2px 6px;
  font-weight: 600;
  color: var(--sf-bg);
  background: var(--sf-signal);
}

.line {
  margin: 0;
  font-family: var(--h-system);
  font-size: clamp(24px, 3.4vw, 40px);
  font-weight: 800;
  line-height: 1.4;
  letter-spacing: 0.02em;
}

.adv-home[data-locale='en'] .line {
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.sf :deep(.h-char) {
  animation-name: sf-char;
  animation-duration: 0.01s;
}

.menu {
  display: grid;
  gap: 8px;
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
  background: rgba(12, 13, 14, 0.85);
  transition:
    color 0.12s,
    background-color 0.12s;
}

.cmd.is-primary {
  border-color: var(--sf-signal);
}

.cmd:hover,
.cmd:focus-visible {
  color: var(--sf-bg);
  background: var(--sf-ink);
}

.cmd-no {
  font-family: var(--h-mono);
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
}

.cmd-sub {
  overflow: hidden;
  font-family: var(--h-mono);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0.6;
}

.cmd-arrow {
  flex: none;
  margin-left: auto;
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

@media (prefers-reduced-motion: reduce) {
  .cmd {
    transition: none;
  }
}
</style>
