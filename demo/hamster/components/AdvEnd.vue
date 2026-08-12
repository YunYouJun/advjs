<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <section class="hamster-end" aria-labelledby="hamster-end-title">
    <div class="hamster-end__orbit" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
    <div class="hamster-end__card">
      <p class="hamster-end__eyebrow">
        OBSERVATION COMPLETE · 16 / 16
      </p>
      <h2 id="hamster-end-title">
        观测归档完成
      </h2>
      <p class="hamster-end__lead">
        最后一束星光已经写入档案。八枚记忆结晶与“回声演算”现已开放。
      </p>
      <div class="hamster-end__rule" />
      <div class="hamster-end__actions">
        <button type="button" @click="router.push('/start')">
          返回标题
        </button>
        <button type="button" class="primary" @click="router.push('/gallery')">
          查看 CG 回廊
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hamster-end {
  --ink: #f3eee4;
  --muted: #aeb8ce;
  --amber: #f6c96b;
  --cyan: #75ddeb;
  position: absolute;
  z-index: 140;
  inset: 0;
  display: grid;
  overflow: hidden;
  place-items: center;
  background:
    radial-gradient(circle at 50% 42%, rgb(26 69 101 / 42%), transparent 30%),
    linear-gradient(120deg, rgb(4 7 14 / 82%), rgb(7 10 18 / 96%));
  color: var(--ink);
  text-align: center;
  backdrop-filter: blur(0.4rem);
}

.hamster-end__orbit,
.hamster-end__orbit i {
  position: absolute;
  border: 1px solid rgb(117 221 235 / 16%);
  border-radius: 50%;
  pointer-events: none;
}
.hamster-end__orbit {
  width: min(68vw, 48rem);
  aspect-ratio: 1;
}
.hamster-end__orbit i {
  inset: 14%;
  border-color: rgb(246 201 107 / 14%);
}
.hamster-end__orbit i:nth-child(2) {
  inset: 30%;
  border-color: rgb(117 221 235 / 22%);
}
.hamster-end__orbit i:nth-child(3) {
  inset: 48%;
  border-color: var(--amber);
  box-shadow: 0 0 2rem rgb(246 201 107 / 48%);
}

.hamster-end__card {
  position: relative;
  width: min(41rem, calc(100% - 2rem));
  border: 1px solid rgb(117 221 235 / 30%);
  background: linear-gradient(145deg, rgb(7 10 18 / 96%), rgb(13 24 45 / 90%));
  padding: clamp(2rem, 6vw, 4.5rem);
  box-shadow: 0 2rem 7rem rgb(0 0 0 / 62%);
}
.hamster-end__eyebrow {
  margin: 0;
  color: var(--cyan);
  font: 0.7rem/1.4 monospace;
  letter-spacing: 0.2em;
}
.hamster-end h2 {
  margin: 0.75rem 0 1rem;
  font:
    600 clamp(2.4rem, 6vw, 5rem)/1.08 'Songti SC',
    STSong,
    serif;
  letter-spacing: 0.08em;
}
.hamster-end__lead {
  max-width: 32rem;
  margin: 0 auto;
  color: var(--muted);
  font:
    1rem/1.9 'Songti SC',
    STSong,
    serif;
}
.hamster-end__rule {
  width: 4rem;
  height: 1px;
  margin: 1.75rem auto;
  background: var(--amber);
}
.hamster-end__actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}
.hamster-end button {
  min-width: 8rem;
  border: 1px solid rgb(117 221 235 / 38%);
  background: rgb(7 12 24 / 76%);
  padding: 0.8rem 1.2rem;
  color: var(--muted);
  cursor: pointer;
}
.hamster-end button.primary,
.hamster-end button:hover,
.hamster-end button:focus-visible {
  border-color: var(--amber);
  color: var(--ink);
  outline: none;
}

@media (max-width: 520px) {
  .hamster-end__orbit {
    width: 130vw;
  }
  .hamster-end__card {
    padding: 2.2rem 1.35rem;
  }
  .hamster-end__actions {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hamster-end *,
  .hamster-end *::before,
  .hamster-end *::after {
    animation: none !important;
  }
}
</style>
