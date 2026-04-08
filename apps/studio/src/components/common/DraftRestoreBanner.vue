<script setup lang="ts">
import { IonButton } from '@ionic/vue'

defineProps<{
  message: string
}>()

defineEmits<{
  restore: []
  discard: []
}>()
</script>

<template>
  <div class="draft-banner-wrapper">
    <div class="draft-banner">
      <span>{{ message }}</span>
      <div class="draft-banner__actions">
        <IonButton fill="solid" size="small" @click="$emit('restore')">
          {{ $t('contentEditor.restoreDraft') }}
        </IonButton>
        <IonButton fill="clear" size="small" color="medium" @click="$emit('discard')">
          {{ $t('contentEditor.discardDraft') }}
        </IonButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draft-banner-wrapper {
  padding: var(--adv-space-md) var(--adv-space-md) 0;
}

.draft-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-primary);
}

.draft-banner__actions {
  display: flex;
  gap: var(--adv-space-xs);
  flex-shrink: 0;
}

@media (max-width: 767px) {
  .draft-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
