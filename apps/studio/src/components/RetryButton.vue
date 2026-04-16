<script setup lang="ts">
import type { ChatMessageError } from '../utils/chatUtils'
import { IonIcon } from '@ionic/vue'
import { alertCircleOutline, refreshOutline } from 'ionicons/icons'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  error: ChatMessageError
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()
const retrying = ref(false)

function handleRetry() {
  if (retrying.value || !props.error.retryable)
    return
  retrying.value = true
  emit('retry')
  // Reset after a timeout in case the parent doesn't unmount us
  setTimeout(() => {
    retrying.value = false
  }, 5000)
}
</script>

<template>
  <div class="retry-container" :class="{ 'retry-container--retryable': error.retryable }">
    <div class="retry-error-info">
      <IonIcon :icon="alertCircleOutline" class="retry-error-icon" />
      <span class="retry-error-type">
        {{ error.type === 'network' ? t('chat.errorNetwork')
          : error.type === 'timeout' ? t('chat.errorTimeout')
            : error.type === 'auth' ? t('chat.errorAuth')
              : error.type === 'rate_limit' ? t('chat.errorRateLimit')
                : t('chat.errorGeneric', { message: '' }) }}
      </span>
    </div>
    <button
      v-if="error.retryable"
      class="retry-btn"
      :class="{ 'retry-btn--loading': retrying }"
      :disabled="retrying"
      @click="handleRetry"
    >
      <IonIcon :icon="refreshOutline" class="retry-btn-icon" :class="{ spinning: retrying }" />
      {{ retrying ? t('chat.retrying') : t('chat.tapToRetry') }}
    </button>
  </div>
</template>

<style scoped>
.retry-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--adv-bg-danger-subtle, rgba(235, 68, 68, 0.08));
  border: 1px solid var(--adv-border-danger, rgba(235, 68, 68, 0.2));
}

.retry-error-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8em;
  color: var(--adv-text-danger, #d93025);
}

.retry-error-icon {
  font-size: 1em;
  flex-shrink: 0;
}

.retry-error-type {
  opacity: 0.85;
}

.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--adv-border-danger, rgba(235, 68, 68, 0.3));
  border-radius: 6px;
  background: var(--adv-bg-danger-subtle, rgba(235, 68, 68, 0.06));
  color: var(--adv-text-danger, #d93025);
  font-size: 0.8em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  align-self: flex-start;
}

.retry-btn:hover:not(:disabled) {
  background: var(--adv-bg-danger, rgba(235, 68, 68, 0.15));
}

.retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.retry-btn-icon {
  font-size: 0.95em;
}

.retry-btn-icon.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
