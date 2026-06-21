<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { track } from '../utils/telemetry'

const { t } = useI18n()

const hasError = ref(false)
const errorMessage = ref('')

onErrorCaptured((err: Error) => {
  hasError.value = true
  errorMessage.value = err.message || 'Unknown error'
  console.error('[ErrorBoundary]', err)
  track('error.boundary', {
    msg: err.message,
    stack: (err.stack || '').slice(0, 800),
  })
  return false
})

function handleRetry() {
  hasError.value = false
  errorMessage.value = ''
}

function handleGoHome() {
  hasError.value = false
  errorMessage.value = ''
  window.location.href = '/'
}
</script>

<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-boundary__card">
      <div class="error-boundary__icon">
        ⚠️
      </div>
      <h2 class="error-boundary__title">
        {{ t('errorBoundary.title') }}
      </h2>
      <p class="error-boundary__message">
        {{ t('errorBoundary.message') }}
      </p>
      <details v-if="errorMessage" class="error-boundary__details">
        <summary>{{ t('errorBoundary.details') }}</summary>
        <code>{{ errorMessage }}</code>
      </details>
      <div class="error-boundary__actions">
        <button type="button" class="error-boundary__btn error-boundary__btn--primary" @click="handleRetry">
          {{ t('errorBoundary.retry') }}
        </button>
        <button type="button" class="error-boundary__btn error-boundary__btn--secondary" @click="handleGoHome">
          {{ t('errorBoundary.goHome') }}
        </button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: var(--ion-background-color, #f4f5f8);
}

.error-boundary__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
  padding: 40px 32px;
  background: var(--adv-surface-card, #fff);
  border-radius: var(--adv-radius-lg, 12px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

:root.dark .error-boundary {
  background: var(--ion-background-color, #1a1a2e);
}

:root.dark .error-boundary__card {
  background: var(--adv-surface-card, #1e1e2e);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.error-boundary__icon {
  font-size: var(--adv-font-display-xl);
  margin-bottom: 16px;
}

.error-boundary__title {
  font-size: var(--adv-font-title);
  font-weight: 700;
  color: var(--adv-text-primary, #1e293b);
  margin: 0 0 8px;
}

.error-boundary__message {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary, #64748b);
  margin: 0 0 16px;
  line-height: 1.5;
}

.error-boundary__details {
  width: 100%;
  margin-bottom: 24px;
  text-align: left;
}

.error-boundary__details summary {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary, #94a3b8);
  cursor: pointer;
  margin-bottom: 8px;
}

.error-boundary__details code {
  display: block;
  font-size: var(--adv-font-caption);
  color: var(--adv-danger, #ef4444);
  background: var(--adv-surface-elevated, #f1f5f9);
  padding: 8px 12px;
  border-radius: var(--adv-radius-md, 8px);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

:root.dark .error-boundary__details code {
  background: var(--adv-surface-elevated, #2a2a3e);
}

.error-boundary__actions {
  display: flex;
  gap: 12px;
}

.error-boundary__btn {
  padding: 10px 24px;
  border-radius: var(--adv-radius-lg, 12px);
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.error-boundary__btn:active {
  opacity: 0.8;
}

.error-boundary__btn--primary {
  background: var(--ion-color-primary, #7c3aed);
  color: #fff;
}

.error-boundary__btn--secondary {
  background: var(--adv-surface-elevated, #f1f5f9);
  color: var(--adv-text-secondary, #64748b);
}

:root.dark .error-boundary__btn--secondary {
  background: var(--adv-surface-elevated, #2a2a3e);
  color: var(--adv-text-secondary, #94a3b8);
}
</style>
