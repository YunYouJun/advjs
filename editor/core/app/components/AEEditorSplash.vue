<script setup lang="ts">
import type { EditorStartupState } from '../startup'
import { AGUIButton } from '@advjs/gui'

const props = defineProps<{
  show: boolean
  state: Readonly<EditorStartupState>
}>()

defineEmits<{
  (e: 'retry'): void
}>()

const { t } = useI18n()
const statusText = computed(() => t(`splash.${props.state.phase}`))
const progressText = computed(() => t('splash.completed', { completed: props.state.completed, total: props.state.total }))
</script>

<template>
  <Transition name="ae-splash-fade">
    <div
      v-if="show"
      :aria-busy="state.status === 'loading'"
      class="ae-editor-splash fixed inset-0 z-9999 flex flex-col items-center justify-center"
    >
      <!-- Logo area -->
      <div class="mb-10 flex flex-col items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          role="img"
          aria-label="ADV.JS"
          class="ae-splash-logo h-16 w-16"
        >
          <path fill="currentColor" d="M14 10.25L17 8v6l-3-2.25V14H7V8h7v2.25zM5.763 17H20V5H4v13.385L5.763 17zm.692 2L2 22.5V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.455z" />
        </svg>
        <div class="flex items-center gap-2">
          <span
            class="text-3xl font-bold tracking-wide"
            style="letter-spacing: 0.05em;"
          >
            ADV.JS
          </span>
          <span
            class="ae-splash-secondary text-lg font-light"
          >
            Editor
          </span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="ae-splash-content flex flex-col gap-3 items-center">
        <div
          role="progressbar"
          :aria-label="statusText"
          :aria-valuemin="0"
          :aria-valuemax="state.total"
          :aria-valuenow="state.completed"
          :aria-valuetext="progressText"
          class="ae-splash-track h-1 w-full overflow-hidden rounded-full"
        >
          <div
            class="ae-splash-progress h-full rounded-full"
            :class="{ 'ae-splash-progress-busy': state.status === 'loading' }"
            :style="{ width: `${state.progress}%` }"
          />
        </div>
        <div role="status" aria-live="polite" class="ae-splash-secondary text-xs text-center">
          {{ statusText }}
          <span class="mt-1 block">{{ progressText }}</span>
        </div>
        <template v-if="state.status === 'error'">
          <div role="alert" class="ae-splash-error text-xs text-center">
            <p>{{ t('splash.failed', { task: statusText }) }}</p>
            <p class="ae-splash-secondary">
              {{ state.error }}
            </p>
          </div>
          <AGUIButton theme="primary" @click="$emit('retry')">
            {{ t('splash.retry') }}
          </AGUIButton>
        </template>
      </div>

      <!-- Version -->
      <div
        class="ae-splash-secondary absolute bottom-6 right-6 text-xs"
      >
        v0.1.1
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ae-editor-splash {
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg);
}

.ae-splash-content {
  width: min(320px, calc(100vw - 32px));
}

.ae-splash-error {
  max-width: 100%;
  max-height: 25vh;
  overflow: auto;
  overflow-wrap: anywhere;
  color: var(--agui-c-danger-text);
}

.ae-splash-logo {
  color: var(--agui-c-blue);
}

.ae-splash-secondary {
  color: var(--agui-c-text-2);
}

.ae-splash-track {
  background: var(--agui-c-bg-mute);
}

.ae-splash-progress {
  background: var(--agui-c-primary);
  transition: width 120ms ease-out;
}

.ae-splash-progress-busy {
  animation: ae-splash-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes ae-splash-pulse {
  to {
    opacity: 0.55;
  }
}

.ae-splash-fade-leave-active {
  transition: opacity 0.15s ease;
}

.ae-splash-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ae-splash-progress,
  .ae-splash-fade-leave-active {
    transition: none;
  }

  .ae-splash-progress-busy {
    animation: none;
  }
}
</style>
