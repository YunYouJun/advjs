<script setup lang="ts">
import { useFinale } from '../../../../composables/hero'
import HomeTypewriter from '../../HomeTypewriter.vue'
import BookArt from './BookArt.vue'

const { t, choices, root, plays } = useFinale()
</script>

<template>
  <!-- The last page: the hamster asleep, and 完 -->
  <div ref="root" class="finale bk">
    <div class="page">
      <BookArt class="plate" scene="sleep" />
      <div class="words">
        <HomeTypewriter
          :key="plays"
          as="p"
          class="line"
          :text="t.finale.line"
          :speed="90"
          :instant="plays === 0"
        />
        <span class="fin" aria-hidden="true">{{ t.finale.theEnd }}</span>
      </div>
    </div>

    <nav class="buttons" :aria-label="t.finale.menu">
      <a
        v-for="choice in choices"
        :key="choice.link"
        class="bk-btn"
        :class="{ 'is-primary': choice.primary }"
        :href="choice.link"
        :target="choice.external ? '_blank' : undefined"
        :rel="choice.external ? 'noreferrer' : undefined"
      >
        <span class="label">{{ choice.label }}</span>
        <span class="sub">{{ choice.sub }}</span>
      </a>
    </nav>
  </div>
</template>

<style scoped>
.bk {
  --bk-paper: #fbf6ea;
  --bk-ink: #3c2f22;
  --bk-mute: #a08d72;
  --bk-kai: 'Kaiti SC', 'STKaiti', 'KaiTi', 'BiauKai', var(--h-story);
  display: grid;
  gap: 24px;
  align-items: center;
  padding: 20px;
  border-radius: 18px;
  font-family: var(--bk-kai);
  color: var(--bk-ink);
  background: #d9cdb4;
}

@media (min-width: 960px) {
  .bk {
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 40px;
    padding: 40px;
  }
}

.page {
  display: grid;
  gap: 8px;
  padding: 24px 24px 32px;
  border-radius: 4px 14px 14px 4px;
  background: var(--bk-paper);
  box-shadow:
    -6px 0 0 -3px #efe6d2,
    0 6px 0 -2px #cbbd9f;
}

@media (min-width: 640px) {
  .page {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 24px;
  }
}

.plate {
  aspect-ratio: 520 / 300;
}

.words {
  display: grid;
  gap: 18px;
  justify-items: center;
  text-align: center;
}

.line {
  margin: 0;
  font-size: clamp(22px, 2.8vw, 32px);
  font-weight: 700;
  line-height: 1.6;
}

.adv-home[data-locale='en'] .line {
  font-family: var(--h-story);
  text-wrap: balance;
}

.fin {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 2px solid #e86a4f;
  border-radius: 46% 54% 50% 50% / 55% 45% 55% 45%;
  font-size: 22px;
  color: #e86a4f;
}

.buttons {
  display: grid;
  gap: 12px;
}

.bk-btn {
  display: grid;
  gap: 2px;
  padding: 12px 18px;
  border: 2px solid var(--bk-ink);
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
  color: var(--bk-ink);
  text-decoration: none;
  background: var(--bk-paper);
  box-shadow: 0 3px 0 rgba(60, 47, 34, 0.18);
  transition: transform 0.25s var(--h-ease);
}

.bk-btn.is-primary {
  background: #fde7c2;
}

.bk-btn:hover,
.bk-btn:focus-visible {
  transform: rotate(-1.5deg) translateY(-2px);
}

.label {
  font-size: 18px;
  font-weight: 700;
}

.sub {
  font-family: var(--h-system);
  font-size: 11px;
  color: var(--bk-mute);
}

.bk :is(a, button):focus-visible {
  outline: 2px dashed #e86a4f;
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .bk-btn {
    transition: none;
  }
}
</style>
