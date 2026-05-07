<!--
  ProjectShareCard — visual card meant to be screenshotted into a PNG.

  Layout: fixed 600×360, two columns
    Left:  cover (or gradient placeholder) + project name + description + stats
    Right: QR code that links to the project's share page
    Bottom: ADV.JS Studio watermark

  This is a pure presentational component. It is mounted off-screen by
  `shareUtils.shareProjectAsImage()` and captured via modern-screenshot.
  Don't add interactivity here — it must render deterministically without user
  input.
-->
<script setup lang="ts">
import { computed } from 'vue'
import QRCodeGenerator from './QRCodeGenerator.vue'

const props = defineProps<{
  name: string
  description?: string
  cover?: string
  /** URL the QR code should encode (already short-link if available). */
  qrUrl: string
  stats?: {
    characters: number
    chapters: number
    scenes: number
    knowledge: number
  } | null
  /** Override watermark text. Defaults to "Made with ADV.JS Studio". */
  watermark?: string
}>()

const initial = computed(() => (props.name || '?').trim().slice(0, 1).toUpperCase())
const truncatedDesc = computed(() => {
  if (!props.description)
    return ''
  return props.description.length > 80 ? `${props.description.slice(0, 80)}…` : props.description
})
</script>

<template>
  <div class="share-card">
    <!-- Left: cover + meta + stats -->
    <div class="share-card__left">
      <div
        class="share-card__cover"
        :style="cover ? { backgroundImage: `url(${cover})` } : undefined"
      >
        <span v-if="!cover" class="share-card__cover-initial">{{ initial }}</span>
      </div>
      <div class="share-card__meta">
        <h2 class="share-card__name">
          {{ name }}
        </h2>
        <p v-if="truncatedDesc" class="share-card__desc">
          {{ truncatedDesc }}
        </p>
        <div v-if="stats" class="share-card__stats">
          <span class="share-card__stat">
            <span class="share-card__stat-num">{{ stats.characters }}</span>
            <span class="share-card__stat-label">Characters</span>
          </span>
          <span class="share-card__stat">
            <span class="share-card__stat-num">{{ stats.chapters }}</span>
            <span class="share-card__stat-label">Chapters</span>
          </span>
          <span class="share-card__stat">
            <span class="share-card__stat-num">{{ stats.scenes }}</span>
            <span class="share-card__stat-label">Scenes</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Right: QR code -->
    <div class="share-card__right">
      <div class="share-card__qr">
        <QRCodeGenerator :value="qrUrl" :size="160" :show-actions="false" />
      </div>
      <p class="share-card__qr-hint">
        扫码即玩 · Scan to Play
      </p>
    </div>

    <!-- Watermark -->
    <div class="share-card__watermark">
      {{ watermark || 'Made with ADV.JS Studio · studio.advjs.org' }}
    </div>
  </div>
</template>

<style scoped>
/* Fixed dimensions chosen to match common social aspect ratios (5:3) and
   to ensure the QR code stays at a scannable density. */
.share-card {
  position: relative;
  width: 600px;
  height: 360px;
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 20px;
  padding: 28px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 60%, #6366f1 100%);
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
  border-radius: 16px;
  overflow: hidden;
}

/* ── Left column ── */
.share-card__left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.share-card__cover {
  height: 90px;
  border-radius: 10px;
  background-size: cover;
  background-position: center;
  background-color: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-card__cover-initial {
  font-size: 48px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: -0.02em;
}

.share-card__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.share-card__name {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.25;
  /* Clamp to 2 lines to prevent overflow when name is long */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.share-card__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.78);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.share-card__stats {
  display: flex;
  gap: 18px;
  margin-top: auto;
  padding-top: 6px;
}

.share-card__stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.share-card__stat-num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.share-card__stat-label {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.65);
}

/* ── Right column ── */
.share-card__right {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.share-card__qr {
  background: #ffffff;
  padding: 10px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* Override QRCodeGenerator's flex spacing inside the white box. */
.share-card__qr :deep(.qr-generator) {
  gap: 0;
}

.share-card__qr-hint {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.78);
  text-align: center;
  letter-spacing: 0.04em;
}

/* ── Watermark ── */
.share-card__watermark {
  position: absolute;
  bottom: 10px;
  left: 28px;
  right: 28px;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.5);
  text-align: left;
}
</style>
