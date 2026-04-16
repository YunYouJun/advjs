<script setup lang="ts">
import type { AudioInfo } from '../composables/useProjectContent'
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
} from '@ionic/vue'
import { musicalNoteOutline, pauseOutline, playOutline } from 'ionicons/icons'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useProjectContent } from '../composables/useProjectContent'

const props = defineProps<{
  audio: AudioInfo
}>()

defineEmits<{
  click: [audio: AudioInfo]
}>()

const audioEl = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const blobUrl = ref<string | null>(null)

const formattedDuration = computed(() => {
  const d = props.audio.duration || duration.value
  if (!d)
    return ''
  const min = Math.floor(d / 60)
  const sec = Math.floor(d % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
})

// Load audio blob URL for local files
watch(() => props.audio.src, async (src) => {
  if (blobUrl.value) {
    URL.revokeObjectURL(blobUrl.value)
    blobUrl.value = null
  }

  if (!src)
    return
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')) {
    blobUrl.value = src
    return
  }

  const { getFs } = useProjectContent()
  const fs = getFs()
  if (!fs)
    return

  try {
    blobUrl.value = await fs.readBlobUrl(src)
  }
  catch {
    // Try with adv/audio/ prefix
    try {
      blobUrl.value = await fs.readBlobUrl(`adv/audio/${src}`)
    }
    catch { /* ignore */ }
  }
}, { immediate: true })

function togglePlay() {
  if (!audioEl.value || !blobUrl.value)
    return
  if (isPlaying.value) {
    audioEl.value.pause()
  }
  else {
    audioEl.value.play()
  }
}

function onTimeUpdate() {
  if (audioEl.value)
    currentTime.value = audioEl.value.currentTime
}

function onLoadedMetadata() {
  if (audioEl.value)
    duration.value = audioEl.value.duration
}

function onEnded() {
  isPlaying.value = false
  currentTime.value = 0
}

function onSeek(event: Event) {
  const target = event.target as HTMLInputElement
  if (audioEl.value) {
    audioEl.value.currentTime = Number.parseFloat(target.value)
  }
}

onUnmounted(() => {
  if (blobUrl.value && !props.audio.src?.startsWith('http'))
    URL.revokeObjectURL(blobUrl.value)
})
</script>

<template>
  <IonCard class="audio-card" button @click="$emit('click', audio)">
    <IonCardHeader class="audio-card__header">
      <div class="audio-card__play-area">
        <IonButton
          v-if="blobUrl"
          fill="clear"
          shape="round"
          class="audio-card__play-btn"
          :aria-label="isPlaying ? $t('audio.pause') : $t('audio.play')"
          @click.stop="togglePlay"
        >
          <IonIcon :icon="isPlaying ? pauseOutline : playOutline" />
        </IonButton>
        <div v-else class="audio-card__icon-wrap">
          <IonIcon :icon="musicalNoteOutline" class="audio-card__icon" />
        </div>
      </div>
      <div class="audio-card__info">
        <IonCardTitle class="audio-card__title">
          {{ audio.name }}
        </IonCardTitle>
        <p v-if="audio.description" class="audio-card__desc">
          {{ audio.description }}
        </p>
      </div>
      <span v-if="formattedDuration" class="audio-card__duration">
        {{ formattedDuration }}
      </span>
    </IonCardHeader>

    <!-- Progress bar -->
    <div v-if="isPlaying || currentTime > 0" class="audio-card__progress" @click.stop>
      <input
        type="range"
        class="audio-card__slider"
        :min="0"
        :max="duration || 0"
        :value="currentTime"
        step="0.1"
        @input="onSeek"
      >
    </div>

    <IonCardContent v-if="audio.tags?.length || audio.linkedScenes?.length || audio.linkedChapters?.length">
      <div class="audio-card__meta">
        <span v-for="tag in (audio.tags || []).slice(0, 3)" :key="tag" class="audio-card__tag">
          {{ tag }}
        </span>
        <span v-if="audio.linkedScenes?.length" class="audio-card__link">
          🎬 {{ audio.linkedScenes.length }}
        </span>
        <span v-if="audio.linkedChapters?.length" class="audio-card__link">
          📖 {{ audio.linkedChapters.length }}
        </span>
      </div>
    </IonCardContent>

    <!-- Hidden audio element -->
    <audio
      v-if="blobUrl"
      ref="audioEl"
      :src="blobUrl"
      preload="metadata"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
    />
  </IonCard>
</template>

<style scoped>
.audio-card {
  margin: 0;
}

.audio-card__header {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: 12px;
}

.audio-card__play-area {
  flex-shrink: 0;
}

.audio-card__play-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  width: 40px;
  height: 40px;
  --color: var(--ion-color-primary);
}

.audio-card__icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(139, 92, 246, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.audio-card__icon {
  font-size: 18px;
  color: #8b5cf6;
}

.audio-card__info {
  flex: 1;
  min-width: 0;
}

.audio-card__title {
  font-size: var(--adv-font-body);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audio-card__desc {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
  margin: 2px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audio-card__duration {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.audio-card__progress {
  padding: 0 12px 8px;
}

.audio-card__slider {
  width: 100%;
  height: 4px;
  appearance: none;
  background: var(--adv-border-subtle);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.audio-card__slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  cursor: pointer;
}

.audio-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.audio-card__tag {
  font-size: 10px;
  line-height: 1;
  padding: 2px 7px;
  border-radius: 99px;
  background: rgba(139, 92, 246, 0.08);
  color: #8b5cf6;
  white-space: nowrap;
}

.audio-card__link {
  font-size: 10px;
  color: var(--adv-text-tertiary);
  white-space: nowrap;
}
</style>
