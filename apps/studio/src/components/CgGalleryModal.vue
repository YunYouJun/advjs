<script setup lang="ts">
import type { AdvGalleryItem } from '@advjs/types'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { closeOutline, imageOutline } from 'ionicons/icons'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  open: boolean
  items: AdvGalleryItem[]
  unlockedCgs: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const selected = ref<AdvGalleryItem>()
const unlocked = (item: AdvGalleryItem) => props.unlockedCgs.includes(item.id)

function close() {
  emit('update:open', false)
}

function openLightbox(item: AdvGalleryItem) {
  if (unlocked(item))
    selected.value = item
}

function closeLightbox() {
  selected.value = undefined
}
</script>

<template>
  <IonModal :is-open="open" @did-dismiss="close">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('preview.cgGalleryTitle') }}</IonTitle>
        <IonButtons slot="end">
          <IonButton fill="clear" @click="close">
            <IonIcon slot="icon-only" :icon="closeOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <div v-if="props.items.length === 0" class="cg-empty">
        <IonIcon :icon="imageOutline" />
        <p>{{ t('preview.cgNoUnlocks') }}</p>
      </div>
      <div v-else class="cg-grid">
        <button
          v-for="item in props.items"
          :key="item.id"
          type="button"
          class="cg-cell"
          :class="{ 'cg-cell--locked': !unlocked(item) }"
          :disabled="!unlocked(item)"
          :title="unlocked(item) ? t('preview.cgClickToView') : item.title"
          @click="openLightbox(item)"
        >
          <img
            v-if="unlocked(item)"
            :src="item.thumbnail || item.src"
            :alt="item.alt || item.title"
            class="cg-cell__img"
            loading="lazy"
          >
          <span v-else class="cg-cell__lock">?</span>
          <span class="cg-cell__title">{{ unlocked(item) ? item.title : 'LOCKED' }}</span>
        </button>
      </div>
    </IonContent>

    <!-- Lightbox overlay -->
    <div
      v-if="selected"
      class="cg-lightbox"
      role="button"
      tabindex="0"
      @click="closeLightbox"
      @keydown.escape="closeLightbox"
    >
      <img :src="selected.src" :alt="selected.alt || selected.title" class="cg-lightbox__img">
    </div>
  </IonModal>
</template>

<style scoped>
.cg-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--adv-text-secondary);
}

.cg-empty ion-icon {
  font-size: 48px;
  color: var(--adv-text-tertiary);
}

.cg-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

@media (min-width: 600px) {
  .cg-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.cg-cell {
  position: relative;
  aspect-ratio: 16 / 9;
  border: 1px solid rgba(var(--adv-text-secondary-rgb, 100, 100, 100), 0.15);
  border-radius: var(--adv-radius-md);
  overflow: hidden;
  background: var(--adv-surface-elevated);
  cursor: pointer;
  padding: 0;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease;
}

.cg-cell:hover {
  border-color: var(--ion-color-primary);
  transform: scale(1.02);
}

.cg-cell__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cg-cell--locked {
  cursor: default;
  opacity: 0.58;
}

.cg-cell__lock {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background: linear-gradient(145deg, #0f172a, #1e293b);
  color: #64748b;
  font: 600 2rem/1 monospace;
}

.cg-cell__title {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 0.35rem 0.5rem;
  background: linear-gradient(transparent, rgb(2 6 23 / 88%));
  color: #f8fafc;
  font-size: 0.75rem;
  text-align: left;
}

.cg-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  border: none;
}

.cg-lightbox__img {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
}
</style>
