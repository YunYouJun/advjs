<script setup lang="ts">
import {
  IonButton,
  IonIcon,
  IonLabel,
  IonListHeader,
} from '@ionic/vue'
import { chevronForwardOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'

defineProps<{
  title: string
  count: number
  icon: string
}>()

defineEmits<{
  viewAll: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="dashboard-section">
    <IonListHeader>
      <IonLabel class="dashboard-section__label">
        <IonIcon :icon="icon" class="dashboard-section__icon" />
        {{ title }}
        <span class="dashboard-section__count">({{ count }})</span>
      </IonLabel>
      <IonButton fill="clear" size="small" class="dashboard-section__view-all" @click="$emit('viewAll')">
        {{ t('common.viewAll') }}
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="end" :icon="chevronForwardOutline" />
      </IonButton>
    </IonListHeader>
    <slot />
  </div>
</template>

<style scoped>
.dashboard-section {
  margin-bottom: var(--adv-space-sm);
}

.dashboard-section__label {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
}

.dashboard-section__icon {
  font-size: 18px;
  flex-shrink: 0;
}

.dashboard-section__count {
  font-weight: 400;
  color: var(--adv-text-tertiary);
  font-size: 0.85em;
}

.dashboard-section__view-all {
  text-transform: none;
  font-weight: 500;
  font-size: var(--adv-font-body-sm);
}
</style>
