<script setup lang="ts">
import type { SceneInfo } from '../composables/useProjectContent'
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
} from '@ionic/vue'
import { imageOutline } from 'ionicons/icons'

defineProps<{
  scene: SceneInfo
}>()

defineEmits<{
  click: [scene: SceneInfo]
}>()
</script>

<template>
  <IonCard class="scene-card" button @click="$emit('click', scene)">
    <IonCardHeader>
      <IonCardTitle class="scene-card__title">
        <IonIcon :icon="imageOutline" class="scene-card__icon" />
        {{ scene.name }}
      </IonCardTitle>
    </IonCardHeader>
    <IonCardContent>
      <p class="scene-card__file">
        {{ scene.file }}
      </p>
    </IonCardContent>
  </IonCard>
</template>

<style scoped>
.scene-card {
  margin: 0;
}

.scene-card__title {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  font-size: var(--adv-font-body);
  font-weight: 600;
}

.scene-card__icon {
  flex-shrink: 0;
  color: var(--ion-color-tertiary, #5260ff);
}

.scene-card__file {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
}
</style>
