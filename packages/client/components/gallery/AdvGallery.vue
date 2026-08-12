<script setup lang="ts">
import type { AdvGalleryItem } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import { computed, ref } from 'vue'

const { $adv } = useAdvContext()
const selected = ref<AdvGalleryItem>()
const items = computed(() => $adv.gameConfig.value.gallery?.items ?? [])
const unlockedIds = computed(() => $adv.gallery?.unlocked.value ?? [])
const unlockedCount = computed(() => items.value.filter(item => unlockedIds.value.includes(item.id)).length)

function open(item: AdvGalleryItem) {
  if (unlockedIds.value.includes(item.id))
    selected.value = item
}

async function download(item: AdvGalleryItem) {
  try {
    const response = await fetch(item.src, { mode: 'cors' })
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${item.id}.${blob.type.includes('png') ? 'png' : 'webp'}`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  catch {
    window.open(item.src, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <section class="adv-gallery" aria-labelledby="adv-gallery-title">
    <header class="adv-gallery__header">
      <div>
        <p>MEMORY CRYSTALS</p>
        <h1 id="adv-gallery-title">
          CG 回廊
        </h1>
      </div>
      <strong>{{ unlockedCount }} / {{ items.length }}</strong>
    </header>

    <div class="adv-gallery__grid">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="adv-gallery__item"
        :class="{ 'is-locked': !unlockedIds.includes(item.id) }"
        :aria-label="unlockedIds.includes(item.id) ? item.title : '尚未解锁的 CG'"
        @click="open(item)"
      >
        <img
          v-if="unlockedIds.includes(item.id)"
          :src="item.thumbnail || item.src"
          :alt="item.alt || item.title"
          loading="lazy"
        >
        <span v-else class="adv-gallery__locked-art" aria-hidden="true">?</span>
        <span>{{ unlockedIds.includes(item.id) ? item.title : '记忆尚未形成' }}</span>
      </button>
    </div>

    <div v-if="selected" class="adv-gallery__lightbox" role="dialog" aria-modal="true" :aria-label="selected.title">
      <button class="adv-gallery__close" type="button" aria-label="关闭" @click="selected = undefined">
        ×
      </button>
      <img :src="selected.src" :alt="selected.alt || selected.title">
      <footer>
        <div>
          <p>{{ selected.chapterId || 'MEMORY' }}</p>
          <h2>{{ selected.title }}</h2>
        </div>
        <button
          v-if="$adv.gameConfig.value.gallery?.allowDownload !== false"
          type="button"
          @click="download(selected)"
        >
          下载原图
        </button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.adv-gallery {
  --gallery-ink: var(--adv-gallery-ink, #f3eee4);
  --gallery-muted: var(--adv-gallery-muted, #99a7bf);
  --gallery-accent: var(--adv-gallery-accent, #75ddeb);
  width: min(76rem, calc(100% - 2rem));
  margin: 0 auto;
  padding: clamp(2rem, 6vw, 5rem) 0;
  color: var(--gallery-ink);
}

.adv-gallery__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 2rem;
  border-bottom: 1px solid color-mix(in srgb, var(--gallery-accent), transparent 70%);
  padding-bottom: 1.25rem;
}

.adv-gallery__header p,
.adv-gallery__lightbox p {
  margin: 0;
  color: var(--gallery-accent);
  font: 0.72rem/1.4 monospace;
  letter-spacing: 0.2em;
}

.adv-gallery__header h1 {
  margin: 0.35rem 0 0;
  font: 600 clamp(2rem, 5vw, 4rem)/1.1 serif;
}

.adv-gallery__header strong {
  color: var(--gallery-muted);
  font: 500 1rem/1 monospace;
}

.adv-gallery__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.adv-gallery__item {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border: 1px solid rgb(117 221 235 / 25%);
  background: #080d1a;
  padding: 0;
  color: var(--gallery-ink);
  cursor: pointer;
}

.adv-gallery__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    transform 280ms ease,
    filter 280ms ease;
}

.adv-gallery__locked-art {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background: radial-gradient(circle, rgb(117 221 235 / 10%), transparent 55%), #080d1a;
  color: rgb(117 221 235 / 28%);
  font: 500 3rem/1 monospace;
}

.adv-gallery__item span {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  background: linear-gradient(transparent, rgb(4 7 14 / 92%));
  padding: 2rem 0.8rem 0.7rem;
  text-align: left;
}

.adv-gallery__item:hover img {
  transform: scale(1.025);
}
.adv-gallery__item.is-locked {
  cursor: default;
}

.adv-gallery__lightbox {
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: grid;
  background: rgb(2 4 10 / 96%);
  grid-template-rows: 1fr auto;
  place-items: center;
}

.adv-gallery__lightbox > img {
  max-width: 100vw;
  max-height: calc(100vh - 7rem);
  object-fit: contain;
}

.adv-gallery__lightbox footer {
  display: flex;
  width: min(70rem, calc(100% - 2rem));
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0 1.5rem;
}

.adv-gallery__lightbox h2 {
  margin: 0.3rem 0 0;
}
.adv-gallery__lightbox footer button,
.adv-gallery__close {
  border: 1px solid rgb(117 221 235 / 45%);
  background: rgb(9 14 27 / 90%);
  padding: 0.65rem 1rem;
  color: var(--gallery-ink);
}

.adv-gallery__close {
  position: absolute;
  z-index: 1;
  top: 1rem;
  right: 1rem;
  font-size: 1.5rem;
}

@media (max-width: 900px) {
  .adv-gallery__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .adv-gallery {
    padding-top: 4.5rem;
  }
  .adv-gallery__grid {
    grid-template-columns: 1fr;
  }
}
</style>
