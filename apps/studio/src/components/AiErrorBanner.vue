<script setup lang="ts">
import type { AiAuthoringError } from '../utils/aiAuthoring/result'
import { IonButton, IonIcon, IonNote } from '@ionic/vue'
import { alertCircleOutline, refreshOutline, settingsOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const props = defineProps<{
  error: AiAuthoringError
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()
const router = useRouter()

const colorMap: Record<AiAuthoringError['type'], string> = {
  auth: 'danger',
  rate_limit: 'warning',
  network: 'warning',
  timeout: 'warning',
  not_found: 'danger',
  aborted: 'medium',
  not_configured: 'warning',
  unknown: 'danger',
}

const color = computed(() => colorMap[props.error.type] || 'danger')

const label = computed(() => {
  // Map error type → i18n label
  const key = `aiAuthoring.error.${camelCase(props.error.type)}`
  return t(key)
})

function camelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function gotoSettings() {
  router.push('/tabs/me/ai')
}

const showSettings = computed(() =>
  props.error.type === 'auth' || props.error.type === 'not_configured',
)
</script>

<template>
  <div class="ai-error-banner" :class="`ai-error-banner--${color}`">
    <IonIcon :icon="alertCircleOutline" class="ai-error-banner__icon" />
    <div class="ai-error-banner__body">
      <p class="ai-error-banner__title">
        <strong>{{ label }}</strong>
      </p>
      <IonNote class="ai-error-banner__detail">
        {{ error.message }}
      </IonNote>
    </div>
    <div class="ai-error-banner__actions">
      <IonButton
        v-if="showSettings"
        size="small"
        fill="clear"
        @click="gotoSettings"
      >
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="start" :icon="settingsOutline" />
        {{ t('aiAuthoring.error.gotoSettings') }}
      </IonButton>
      <IonButton
        v-if="error.retryable"
        size="small"
        fill="solid"
        :color="color"
        @click="emit('retry')"
      >
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="start" :icon="refreshOutline" />
        {{ t('aiAuthoring.error.retry') }}
      </IonButton>
    </div>
  </div>
</template>

<style scoped>
.ai-error-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--adv-space-sm);
  margin: 0 var(--adv-space-md) var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  border-left: 3px solid currentColor;
  background: var(--ion-color-light, rgba(0, 0, 0, 0.04));
}

.ai-error-banner--danger {
  color: var(--ion-color-danger, #eb445a);
}

.ai-error-banner--warning {
  color: var(--ion-color-warning, #ffc409);
}

.ai-error-banner--medium {
  color: var(--ion-color-medium, #92949c);
}

.ai-error-banner__icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.ai-error-banner__body {
  flex: 1;
  min-width: 0;
}

.ai-error-banner__title {
  margin: 0 0 4px;
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body-sm);
}

.ai-error-banner__detail {
  display: block;
  font-size: var(--adv-font-caption);
  word-break: break-word;
}

.ai-error-banner__actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}
</style>
