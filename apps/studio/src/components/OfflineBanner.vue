<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { wifiOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { useNetworkStatus } from '../composables/useNetworkStatus'

const { t } = useI18n()
const { isOnline } = useNetworkStatus()
</script>

<template>
  <Transition name="offline-banner">
    <div v-if="!isOnline" class="offline-banner">
      <IonIcon :icon="wifiOutline" class="offline-banner__icon" />
      <span class="offline-banner__text">{{ t('offline.banner') }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--adv-warning-bg, #fef3c7);
  color: var(--adv-warning-text, #92400e);
  font-size: var(--adv-font-body-sm);
  font-weight: 500;
  z-index: 999;
  position: relative;
}

:root.dark .offline-banner {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.offline-banner__icon {
  font-size: var(--adv-font-body-sm);
  flex-shrink: 0;
}

.offline-banner-enter-active,
.offline-banner-leave-active {
  transition: all 0.3s ease;
}

.offline-banner-enter-from,
.offline-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
