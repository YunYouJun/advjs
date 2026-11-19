<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'

const { src } = defineProps<{ src: string }>()

const audio = useTemplateRef<HTMLAudioElement>('audio')
const state = shallowRef<'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'>('idle')
const progress = shallowRef(0)
const label = computed(() => ({
  idle: '听小云打招呼',
  loading: '正在加载试听…',
  playing: '暂停小云的开场',
  paused: '继续试听',
  ended: '再听一遍',
  error: '重试试听',
})[state.value])

async function togglePlayback() {
  const player = audio.value
  if (!player || state.value === 'loading')
    return
  if (!player.paused && !player.ended) {
    player.pause()
    return
  }

  const needsSource = !player.hasAttribute('src') || state.value === 'error'
  state.value = 'loading'
  if (needsSource) {
    progress.value = 0
    player.src = src
  }
  try {
    await player.play()
  }
  catch {
    state.value = 'error'
  }
}

function updateProgress() {
  const player = audio.value
  if (player && Number.isFinite(player.duration) && player.duration > 0)
    progress.value = player.currentTime / player.duration
}

onBeforeUnmount(() => audio.value?.pause())
</script>

<template>
  <div class="voice-preview">
    <button
      type="button"
      class="voice-preview__button"
      :aria-busy="state === 'loading'"
      :class="{ 'voice-preview__button--playing': state === 'playing' }"
      @click="togglePlayback"
    >
      <span class="voice-preview__cloud" aria-hidden="true">
        <span :class="state === 'playing' ? 'i-ri-pause-mini-fill' : 'i-ri-play-mini-fill'" />
      </span>
      <span>{{ label }}</span>
      <span class="voice-preview__wave" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </span>
      <span class="voice-preview__progress" aria-hidden="true" :style="{ transform: `scaleX(${progress})` }" />
    </button>
    <audio
      ref="audio"
      preload="none"
      @playing="state = 'playing'"
      @pause="state === 'playing' && (state = 'paused')"
      @timeupdate="updateProgress"
      @ended="state = 'ended'"
      @error="state = 'error'"
    />
    <span v-if="state === 'error'" class="voice-preview__error" role="status">音频加载失败，请重试。</span>
  </div>
</template>

<style scoped>
.voice-preview {
  margin-block: 1rem;
}

.voice-preview__button {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  width: min(100%, 21rem);
  min-height: 4.5rem;
  padding: 0.85rem 1rem;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-2), transparent 68%);
  border-radius: 1.25rem;
  background: linear-gradient(110deg, var(--vp-c-brand-soft), var(--vp-c-bg-soft));
  color: var(--vp-c-text-1);
  font-weight: 600;
  text-align: start;
  cursor: pointer;
}

.voice-preview__button:hover {
  border-color: var(--vp-c-brand-2);
}

.voice-preview__button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}

.voice-preview__button[aria-busy='true'] {
  cursor: progress;
}

.voice-preview__cloud {
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  width: 48px;
  height: 26px;
  margin-top: 8px;
  border-radius: 1rem;
  background: #c5eaff;
  color: #164d7b;
  font-size: 1.2rem;
}

.voice-preview__cloud::before,
.voice-preview__cloud::after {
  position: absolute;
  z-index: -1;
  bottom: 10px;
  border-radius: 50%;
  background: inherit;
  content: '';
}

.voice-preview__cloud::before {
  left: 8px;
  width: 24px;
  height: 25px;
}

.voice-preview__cloud::after {
  right: 6px;
  width: 16px;
  height: 19px;
}

.voice-preview__wave {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--vp-c-brand-1);
}

.voice-preview__wave i {
  width: 3px;
  height: 9px;
  border-radius: 2px;
  background: currentColor;
}

.voice-preview__wave i:nth-child(even) {
  height: 17px;
}

.voice-preview__wave i:nth-child(3) {
  height: 24px;
}

.voice-preview__progress {
  position: absolute;
  inset: auto 0 0;
  height: 3px;
  background: var(--vp-c-brand-2);
  transform-origin: left;
}

.voice-preview__error {
  display: block;
  margin-top: 0.25rem;
  color: var(--vp-c-danger-1);
  font-size: 0.875rem;
}

@media (prefers-reduced-motion: no-preference) {
  .voice-preview__button--playing .voice-preview__wave i {
    animation: voice-preview-beat 0.7s ease-in-out infinite alternate;
  }

  .voice-preview__button--playing .voice-preview__wave i:nth-child(even) {
    animation-delay: -0.35s;
  }
}

@keyframes voice-preview-beat {
  from {
    transform: scaleY(0.45);
  }
  to {
    transform: scaleY(1);
  }
}
</style>
