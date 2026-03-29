<script setup lang="ts">
import type { ChapterInfo } from '../composables/useProjectContent'
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonNote,
} from '@ionic/vue'
import { documentTextOutline, playOutline } from 'ionicons/icons'

defineProps<{
  chapter: ChapterInfo
}>()

defineEmits<{
  edit: [file: string]
  play: [file: string]
}>()
</script>

<template>
  <IonCard class="chapter-card">
    <IonCardHeader>
      <IonCardTitle class="chapter-card__title">
        <IonIcon :icon="documentTextOutline" class="chapter-card__icon" />
        {{ chapter.name }}
      </IonCardTitle>
    </IonCardHeader>
    <IonCardContent>
      <p v-if="chapter.preview" class="chapter-card__preview">
        {{ chapter.preview }}
      </p>
      <IonNote v-else class="chapter-card__empty">
        ---
      </IonNote>
      <div class="chapter-card__actions">
        <IonButton size="small" fill="outline" @click.stop="$emit('edit', chapter.file)">
          {{ $t('preview.edit') }}
        </IonButton>
        <IonButton size="small" fill="solid" @click.stop="$emit('play', chapter.file)">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="playOutline" />
          {{ $t('preview.title') }}
        </IonButton>
      </div>
    </IonCardContent>
  </IonCard>
</template>

<style scoped>
.chapter-card {
  margin: 0;
}

.chapter-card__title {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  font-size: var(--adv-font-body);
  font-weight: 600;
}

.chapter-card__icon {
  flex-shrink: 0;
  color: var(--ion-color-primary);
}

.chapter-card__preview {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  line-height: 1.5;
  margin: 0 0 var(--adv-space-sm);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chapter-card__empty {
  display: block;
  margin-bottom: var(--adv-space-sm);
}

.chapter-card__actions {
  display: flex;
  gap: var(--adv-space-xs);
  justify-content: flex-end;
}
</style>
