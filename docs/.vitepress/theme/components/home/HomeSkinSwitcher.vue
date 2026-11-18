<script setup lang="ts">
import type { SkinId } from './data/skin-ids'
import { computed, ref, useId } from 'vue'
import { useHomeCopy } from '../../composables/home'
import { useHomeSkin } from '../../composables/skin'
import { SKINS } from './data/skin-ids'

/**
 * Picks the game the page plays: a shelf of title cards, each a tiny still of its world.
 * Unpicked cards wait in faded colour and wake on hover; the picked one is framed in its own
 * material. A radio group: one tab stop, arrow keys move and select.
 * `compact` drops the label and genres, for the script demo's header.
 */
const props = defineProps<{ compact?: boolean }>()

const t = useHomeCopy()
const { skin, set, preload } = useHomeSkin()
const labelId = useId()

const items = computed(() => SKINS.map(id => ({ id, ...t.value.skins[id] })))
const buttons = ref<HTMLButtonElement[]>([])
const announcement = ref('')

function pick(id: SkinId) {
  if (id === skin.value)
    return
  set(id)
  announcement.value = t.value.skins.switched(t.value.skins[id].name)
}

function onKeydown(event: KeyboardEvent, index: number) {
  const last = SKINS.length - 1
  const to = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowDown: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    ArrowUp: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key]
  if (to === undefined)
    return
  event.preventDefault()
  pick(SKINS[to])
  buttons.value[to]?.focus()
}
</script>

<template>
  <div class="shelf" :class="{ 'is-compact': props.compact }">
    <span :id="labelId" class="shelf-label" :class="{ 'h-sr': props.compact }">{{ t.skins.label }}</span>
    <div class="cards" role="radiogroup" :aria-labelledby="labelId">
      <button
        v-for="(item, i) in items"
        :key="item.id"
        ref="buttons"
        type="button"
        role="radio"
        class="card"
        :class="`is-${item.id}`"
        :aria-checked="skin === item.id"
        :tabindex="skin === item.id ? 0 : -1"
        @click="pick(item.id)"
        @keydown="onKeydown($event, i)"
        @pointerenter="preload(item.id)"
        @focus="preload(item.id)"
      >
        <!-- A still from each world -->
        <svg class="still" viewBox="0 0 64 44" aria-hidden="true">
          <template v-if="item.id === 'tram'">
            <rect width="64" height="44" fill="#111614" />
            <rect x="4" y="5" width="56" height="7" rx="2" fill="#080a09" />
            <path d="M8 8.5h48" stroke="#ffb13b" stroke-width="2" stroke-dasharray="1.4 1.4" />
            <rect x="4" y="15" width="56" height="17" rx="3" fill="#13265a" />
            <path d="M4 32v-8h6v-5h5v8h4v-11h6v11h5v-6h7v6h4v-9h6v9h5v-4h8v9z" fill="#0c1838" />
            <g fill="#ffcf73"><rect x="12" y="21" width="1.4" height="1.4" /><rect x="22" y="18" width="1.4" height="1.4" /><rect x="41" y="25" width="1.4" height="1.4" /></g>
            <rect x="4" y="35" width="56" height="5" rx="1.5" fill="#080a09" />
          </template>
          <template v-else-if="item.id === 'scifi'">
            <rect width="64" height="44" fill="#0c0d0e" />
            <g fill="none" stroke="#e9e7e1" stroke-opacity="0.35"><circle cx="30" cy="22" r="8" /><circle cx="30" cy="22" r="16" stroke-dasharray="1 2.5" /></g>
            <ellipse cx="30" cy="22" rx="20" ry="7" fill="none" stroke="#e9e7e1" stroke-opacity="0.7" transform="rotate(-18 30 22)" />
            <circle cx="30" cy="22" r="2.4" fill="#e9e7e1" />
            <circle class="moon" cx="46" cy="14" r="1.8" fill="#ff5a1f" />
            <path d="M50 8h-2v2M56 8h2v2M50 18h-2v-2M56 18h2v-2" stroke="#ff5a1f" fill="none" stroke-width="0.9" />
          </template>
          <template v-else-if="item.id === 'romance'">
            <rect width="64" height="44" fill="#f3dfca" />
            <rect x="6" y="5" width="26" height="24" fill="#fff8ee" />
            <rect x="8" y="7" width="22" height="7" fill="#fde3b8" /><rect x="8" y="14" width="22" height="7" fill="#f9c895" /><rect x="8" y="21" width="22" height="6" fill="#ec9673" />
            <circle cx="22" cy="22" r="4" fill="#fff4dc" />
            <rect x="44" y="4" width="18" height="30" fill="#8e5c3f" />
            <g><rect x="45" y="8" width="3" height="8" fill="#3b4a6b" /><rect x="48.5" y="9" width="3" height="7" fill="#d94f6a" /><rect x="52" y="8" width="3" height="8" fill="#e8b04a" /><rect x="55.5" y="10" width="3" height="6" fill="#7a9e8e" /></g>
            <rect x="4" y="32" width="56" height="9" rx="4.5" fill="#fffdf9" />
            <path class="beat" d="M10 36.5l-2-2a1.3 1.3 0 0 1 2-1.6a1.3 1.3 0 0 1 2 1.6z" fill="#d94f6a" />
          </template>
          <template v-else-if="item.id === 'fantasy'">
            <rect width="64" height="44" fill="#ece2cb" />
            <path d="M0 36c10-3 16 2 26-1s18-5 38 0v9H0z" fill="#dfd3b6" />
            <path d="M44 4c-2 6 2 10 -1 16s-4 10-3 14" stroke="#2a1f16" stroke-width="2" fill="none" />
            <path d="M6 26c8-4 14-12 22-10s10 10 16 8s8-10 14-14" stroke="#a8321c" stroke-width="1.2" stroke-dasharray="2 2" fill="none" />
            <path d="M52 9l4 4M56 9l-4 4" stroke="#a8321c" stroke-width="1.6" />
            <g fill="#2a1f16"><rect x="4" y="25" width="4" height="3" /><path d="M3.4 25l2.6-2.4 2.6 2.4z" /></g>
            <rect x="0.5" y="0.5" width="63" height="43" fill="none" stroke="#2a1f16" stroke-width="0.8" />
          </template>
          <template v-else>
            <rect width="64" height="44" fill="#fbf6ea" />
            <rect x="5" y="6" width="16" height="13" rx="1.5" fill="#bfe0d8" />
            <circle cx="40" cy="22" r="13" fill="none" stroke="#7fb3a6" stroke-width="2" />
            <g class="hamster">
              <ellipse cx="40" cy="31" rx="7" ry="4.6" fill="#f2b45a" />
              <circle cx="35.5" cy="27.5" r="1.8" fill="#f2b45a" />
              <circle cx="34.6" cy="30.4" r="0.7" fill="#3c2f22" />
            </g>
            <ellipse cx="34" cy="38" rx="26" ry="2.4" fill="#efe2c4" />
          </template>
        </svg>
        <span class="text">
          <span class="name">{{ item.name }}</span>
          <span v-if="!props.compact" class="genre">{{ item.genre }}</span>
        </span>
      </button>
    </div>
    <span v-if="!props.compact" class="h-sr" aria-live="polite">{{ announcement }}</span>
  </div>
</template>

<style scoped>
.shelf {
  display: grid;
  gap: 10px;
}

@media (min-width: 1100px) {
  .shelf:not(.is-compact) {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 24px;
  }
}

.shelf-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.24em;
  color: var(--vp-c-text-3);
}

.cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

@media (min-width: 640px) {
  .cards {
    gap: 10px;
  }
}

/* Each card is its world's own paper, ink and accent */
.card {
  --paper: #fff;
  --ink: #222;
  --accent: #222;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
  min-width: 0;
  padding: 5px 5px 7px;
  border-radius: 10px;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  background: var(--paper);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
  filter: saturate(0.25);
  opacity: 0.72;
  transition:
    filter 0.3s ease,
    opacity 0.3s ease,
    box-shadow 0.3s ease;
}

@media (min-width: 640px) {
  .card {
    flex-direction: row;
    gap: 10px;
    align-items: center;
    padding: 5px 12px 5px 5px;
  }
}

/* Hover restores colour while every card stays aligned in its row. */
.card:hover,
.card:focus-visible {
  filter: none;
  opacity: 1;
}

.card[aria-checked='true'] {
  filter: none;
  opacity: 1;
  box-shadow: 0 10px 18px -12px rgba(0, 0, 0, 0.5);
}

.still {
  display: block;
  flex: none;
  width: 100%;
  height: auto;
  border-radius: 6px;
  overflow: hidden;
}

@media (min-width: 640px) {
  .still {
    width: 64px;
  }
}

.text {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.name {
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

@media (min-width: 640px) {
  .name {
    overflow: hidden;
    font-size: 14px;
    text-align: left;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

.genre {
  display: none;
  font-size: 11px;
  letter-spacing: 0.08em;
  opacity: 0.65;
}

@media (min-width: 900px) {
  .genre {
    display: block;
  }
}

.adv-home .card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* 末班电车: green-black car, amber LEDs, an enamel rule when picked */
.card.is-tram {
  --paper: #111614;
  --ink: #ffb13b;
  --accent: #1e6b50;
}

.is-tram .name {
  text-shadow: 0 0 6px rgba(255, 177, 59, 0.6);
}

.is-tram[aria-checked='true'] {
  box-shadow:
    inset 0 0 0 2px #1e6b50,
    inset 0 0 0 3.5px #eef3ef,
    0 10px 18px -12px rgba(0, 0, 0, 0.6);
}

/* 星海观测站: graphite, mono type, orange corner brackets when picked */
.card.is-scifi {
  --paper: #0c0d0e;
  --ink: #e9e7e1;
  --accent: #ff5a1f;
  border-radius: 3px;
}

.is-scifi .name {
  font-family: var(--h-mono);
  font-size: 12.5px;
  letter-spacing: 0.04em;
}

.is-scifi[aria-checked='true']::before,
.is-scifi[aria-checked='true']::after {
  content: '';
  position: absolute;
  width: 9px;
  height: 9px;
  border: solid #ff5a1f;
}

.is-scifi[aria-checked='true']::before {
  top: -3px;
  left: -3px;
  border-width: 2px 0 0 2px;
}

.is-scifi[aria-checked='true']::after {
  right: -3px;
  bottom: -3px;
  border-width: 0 2px 2px 0;
}

/* 放课后: sunset paper, rounded type, a white and rose ring when picked */
.card.is-romance {
  --paper: #f3dfca;
  --ink: #4a3a35;
  --accent: #d94f6a;
  border-radius: 14px;
  font-family: 'Hiragino Maru Gothic ProN', 'Yuanti SC', 'YuanTi SC', 'Arial Rounded MT Bold', var(--h-system);
}

.is-romance[aria-checked='true'] {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px #d94f6a,
    0 10px 18px -12px rgba(120, 60, 40, 0.6);
}

/* 地图之外: parchment, Song type, a double rule when picked */
.card.is-fantasy {
  --paper: #ece2cb;
  --ink: #2a1f16;
  --accent: #a8321c;
  border-radius: 2px;
  font-family: var(--h-story);
}

.is-fantasy[aria-checked='true'] {
  outline: 1.5px solid #2a1f16;
  outline-offset: 2px;
  box-shadow:
    inset 0 0 0 1px #2a1f16,
    0 10px 18px -12px rgba(42, 31, 22, 0.6);
}

.is-fantasy[aria-checked='true'] .name {
  color: #a8321c;
}

/* 小仓鼠的夏天: cream paper, Kai type, a wobbly pen line when picked */
.card.is-book {
  --paper: #fbf6ea;
  --ink: #3c2f22;
  --accent: #e86a4f;
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
  font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', 'BiauKai', var(--h-story);
}

.is-book .still {
  border-radius: 40px 8px 30px 8px / 8px 30px 8px 40px;
}

.is-book[aria-checked='true'] {
  box-shadow:
    0 0 0 2px #3c2f22,
    0 10px 18px -12px rgba(60, 47, 34, 0.6);
}

/* The picked still comes alive a little */
.card[aria-checked='true'] .moon {
  transform-box: view-box;
  transform-origin: 30px 22px;
  animation: card-orbit 6s linear infinite;
}

.card[aria-checked='true'] .beat {
  transform-box: fill-box;
  transform-origin: 50% 60%;
  animation: card-beat 1.2s ease-in-out infinite;
}

.card[aria-checked='true'] .hamster {
  animation: card-hop 0.5s ease-in-out infinite alternate;
}

:root.dark .card {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
}

/* Compact: the script demo's header */
.is-compact .cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.is-compact .card {
  flex-direction: row;
  gap: 8px;
  align-items: center;
  padding: 4px 10px 4px 4px;
}

.is-compact .still {
  width: 40px;
}

.is-compact .name {
  font-size: 13px;
}

@media (max-width: 639px) {
  .is-compact .card {
    padding: 4px;
  }

  /* Stills only, but the names stay for screen readers */
  .is-compact .text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
}

@keyframes card-orbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes card-beat {
  50% {
    transform: scale(1.3);
  }
}

@keyframes card-hop {
  to {
    transform: translateY(-1.5px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }

  .card[aria-checked='true'] :is(.moon, .beat, .hamster) {
    animation: none;
  }
}
</style>
