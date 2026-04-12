<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useWorldClockStore } from '../stores/useWorldClockStore'
import { useWorldEventStore } from '../stores/useWorldEventStore'

defineProps<{
  autoDiaryInProgress: boolean
}>()
const emit = defineEmits<{
  advanceTime: []
}>()
const { t } = useI18n()
const clockStore = useWorldClockStore()
const eventStore = useWorldEventStore()

function toggleClock() {
  if (clockStore.clock.running)
    clockStore.pause()
  else
    clockStore.start()
}
</script>

<template>
  <div class="world-clock-bar">
    <div class="world-clock-info">
      <span class="world-clock-date">📅 {{ clockStore.clock.date }}</span>
      <span class="world-clock-period">{{ clockStore.getPeriodEmoji() }} {{ clockStore.getPeriodLabel() }}</span>
      <span v-if="clockStore.clock.weather" class="world-clock-weather">☁️ {{ clockStore.clock.weather }}</span>
    </div>
    <div class="world-clock-controls">
      <button
        class="world-clock-btn"
        :title="clockStore.clock.running ? t('world.pauseClock') : t('world.startClock')"
        @click="toggleClock"
      >
        {{ clockStore.clock.running ? '⏸️' : '▶️' }}
      </button>
      <button
        class="world-clock-btn"
        :disabled="eventStore.isGenerating"
        :title="t('world.advanceTime')"
        @click="emit('advanceTime')"
      >
        ⏭️
      </button>
      <span v-if="autoDiaryInProgress" class="world-auto-diary-hint">
        {{ t('world.autoDiaryGenerating') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.world-clock-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--adv-space-sm) var(--adv-space-md);
  background: var(--adv-surface-card, #fff);
  border-radius: var(--adv-radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

:root.dark .world-clock-bar {
  background: var(--adv-surface-card, #1e1e2e);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.world-clock-info {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm, 8px);
  flex-wrap: wrap;
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-primary);
}

.world-clock-date {
  font-weight: 600;
}

.world-clock-period {
  color: var(--adv-text-secondary);
}

.world-clock-weather {
  color: var(--adv-text-tertiary, #94a3b8);
}

.world-clock-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.world-auto-diary-hint {
  font-size: var(--adv-font-caption, 11px);
  color: #8b5cf6;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

.world-clock-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--adv-surface-elevated, #f1f5f9);
  border-radius: var(--adv-radius-md, 8px);
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.world-clock-btn:hover {
  background: var(--adv-surface-hover, #e2e8f0);
}

.world-clock-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

:root.dark .world-clock-btn {
  background: var(--adv-surface-elevated, #2a2a3e);
}

:root.dark .world-clock-btn:hover {
  background: var(--adv-surface-hover, #3a3a4e);
}
</style>
