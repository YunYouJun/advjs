<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue'
import { folderOpenOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'

defineEmits<{
  reconnect: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="workspace-reconnect">
    <div class="workspace-reconnect__icon">
      <IonIcon :icon="folderOpenOutline" />
    </div>
    <p class="workspace-reconnect__text">
      {{ t('workspace.reSelectDir') }}
    </p>
    <IonButton size="default" @click="$emit('reconnect')">
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
      <IonIcon slot="start" :icon="folderOpenOutline" />
      {{ t('workspace.reconnect') }}
    </IonButton>
  </div>
</template>

<style scoped>
.workspace-reconnect {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--adv-space-md);
  padding: var(--adv-space-lg);
  text-align: center;
}

.workspace-reconnect__icon {
  font-size: 48px;
  color: var(--adv-text-tertiary);
  opacity: 0.5;
}

.workspace-reconnect__text {
  font-size: var(--adv-font-body);
  color: var(--adv-text-secondary);
  max-width: 280px;
  margin: 0;
  line-height: 1.5;
}
</style>
