<script setup lang="ts">
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
  unlockedCgs: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const lightboxUrl = ref<string | null>(null)

function close() {
  emit('update:open', false)
}

function openLightbox(url: string) {
  lightboxUrl.value = url
}

function closeLightbox() {
  lightboxUrl.value = null
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
      <div v-if="props.unlockedCgs.length === 0" class="cg-empty">
        <IonIcon :icon="imageOutline" />
        <p>{{ t('preview.cgNoUnlocks') }}</p>
      </div>
      <div v-else class="cg-grid">
        <button
          v-for="url in props.unlockedCgs"
          :key="url"
          type="button"
          class="cg-cell"
          :title="t('preview.cgClickToView')"
          @click="openLightbox(url)"
        >
          <img :src="url" :alt="url" class="cg-cell__img" loading="lazy">
        </button>
      </div>
    </IonContent>

    <!-- Lightbox overlay -->
    <div
      v-if="lightboxUrl"
      class="cg-lightbox"
      role="button"
      tabindex="0"
      @click="closeLightbox"
      @keydown.escape="closeLightbox"
    >
      <img :src="lightboxUrl" :alt="lightboxUrl" class="cg-lightbox__img">
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
