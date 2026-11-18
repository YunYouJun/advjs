<script setup lang="ts">
import { useFinale } from '../../../../composables/hero'
import HomeRain from '../../HomeRain.vue'
import HomeTypewriter from '../../HomeTypewriter.vue'

/** Line colours of the transfer signs. */
const SIGNS = ['var(--h-enamel)', '#2f6fb5', '#b5531f']

const { t, choices, root, plays } = useFinale()
</script>

<template>
  <!-- The terminus: the last stop under a platform lamp, in a light rain -->
  <div ref="root" class="finale h-car">
    <div class="scenery" aria-hidden="true">
      <HomeRain :density="0.5" />
      <div class="canopy" />
      <div class="lamp" />
      <div class="platform" />
    </div>

    <div class="h-led-board board">
      <span class="h-plate">{{ t.finale.terminus }}</span>
      <HomeTypewriter
        :key="plays"
        as="p"
        class="line h-led-dots"
        :text="t.finale.line"
        :speed="90"
        :instant="plays === 0"
      />
    </div>

    <nav class="choices" :aria-label="t.finale.menu">
      <a
        v-for="(choice, i) in choices"
        :key="choice.link"
        class="h-sign"
        :style="{ '--sign': SIGNS[i] }"
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
  </div>
</template>

<style scoped>
.finale {
  display: grid;
  gap: 28px;
  align-items: center;
  padding: 56px 20px 40px;
}

@media (min-width: 960px) {
  .finale {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 48px;
    padding: 88px 64px 72px;
  }
}

.scenery {
  position: absolute;
  inset: 0;
  z-index: -1;
}

/* The platform roof and its lamp */
.canopy {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 18px;
  background: #1a211e;
  box-shadow: 0 1px 0 var(--h-car-line);
}

.lamp {
  position: absolute;
  top: 18px;
  left: 30%;
  width: 140px;
  height: 8px;
  margin-left: -70px;
  border-radius: 0 0 6px 6px;
  background: #f3dcb4;
  box-shadow:
    0 0 24px 4px rgba(255, 196, 107, 0.4),
    0 120px 200px 80px rgba(255, 177, 59, 0.06);
}

.platform {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 16px;
  background: repeating-linear-gradient(90deg, #d9b23a 0 22px, #111614 22px 34px);
  opacity: 0.55;
}

.board {
  padding: 34px 22px 26px;
}

.board > .h-plate {
  position: absolute;
  top: 0;
  left: 18px;
  transform: translateY(-50%);
}

@media (min-width: 640px) {
  .board {
    padding: 38px 32px 30px;
  }
}

.line {
  margin: 0;
  font-family: var(--h-story);
  font-size: clamp(24px, 3.4vw, 38px);
  font-weight: 900;
  line-height: 1.5;
  letter-spacing: 0.03em;
}

.adv-home[data-locale='en'] .line {
  letter-spacing: 0;
  text-wrap: balance;
}

.choices {
  display: grid;
  gap: 12px;
}

.choices .h-sign:hover,
.choices .h-sign:focus-visible {
  transform: translateX(4px);
}
</style>
