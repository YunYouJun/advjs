<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { TimelineEntry } from '../types/timeline'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { EVENT_TYPE_EMOJI } from '../types/timeline'
import { exportTimelineToCSV } from '../utils/csvExport'
import { downloadAsFile } from '../utils/fileAccess'
import WorldTimeline from './WorldTimeline.vue'

const props = defineProps<{
  isGenerating: boolean
  recentEvents: { id: string, type: string, summary: string }[]
  timelineEntries: TimelineEntry[]
  displayCharacters: AdvCharacter[]
}>()

const emit = defineEmits<{
  selectCharacter: [characterId: string]
}>()

const { t } = useI18n()
const showEvents = ref(true)
const timelineView = ref<'list' | 'timeline'>('list')

function handleExportTimeline() {
  if (props.timelineEntries.length === 0)
    return
  const csv = exportTimelineToCSV(props.timelineEntries)
  downloadAsFile(csv, 'timeline.csv', 'text/csv;charset=utf-8')
}
</script>

<template>
  <div class="world-events-section">
    <div class="world-events-header-row">
      <button
        class="world-events-header"
        @click="showEvents = !showEvents"
      >
        <span>🌍 {{ t('world.worldDynamics') }}</span>
        <span class="world-events-toggle">{{ showEvents ? '▼' : '▶' }}</span>
      </button>
      <div v-if="showEvents" class="world-events-view-switch">
        <button
          class="world-view-btn"
          :class="{ active: timelineView === 'list' }"
          @click="timelineView = 'list'"
        >
          {{ t('world.timelineList') }}
        </button>
        <button
          class="world-view-btn"
          :class="{ active: timelineView === 'timeline' }"
          @click="timelineView = 'timeline'"
        >
          {{ t('world.timeline') }}
        </button>
        <button
          v-if="timelineEntries.length > 0"
          class="world-view-btn"
          :title="t('world.exportTimeline')"
          @click="handleExportTimeline"
        >
          📥
        </button>
      </div>
    </div>

    <div v-if="showEvents">
      <!-- List view -->
      <div v-if="timelineView === 'list'" class="world-events-list">
        <div v-if="isGenerating" class="world-events-loading">
          {{ t('world.generatingEvents') }}
        </div>
        <div v-else-if="recentEvents.length === 0" class="world-events-empty">
          {{ t('world.noEvents') }}
        </div>
        <div
          v-for="event in recentEvents"
          :key="event.id"
          class="world-event-item"
        >
          <span class="world-event-icon">{{ EVENT_TYPE_EMOJI[event.type] || '🔵' }}</span>
          <span class="world-event-summary">{{ event.summary }}</span>
        </div>
      </div>

      <!-- Timeline view -->
      <WorldTimeline
        v-else
        :entries="timelineEntries"
        :characters="displayCharacters"
        @select-character="(id: string) => emit('selectCharacter', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.world-events-section {
  margin: var(--adv-space-sm) var(--adv-space-md);
  background: var(--adv-surface-card, #fff);
  border-radius: var(--adv-radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

:root.dark .world-events-section {
  background: var(--adv-surface-card, #1e1e2e);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.world-events-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: var(--adv-space-sm);
}

.world-events-header-row .world-events-header {
  flex: 1;
}

.world-events-view-switch {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.world-view-btn {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--adv-border-subtle, #e2e8f0);
  background: var(--adv-surface-elevated, #f8fafc);
  color: var(--adv-text-tertiary, #94a3b8);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.world-view-btn:hover {
  border-color: rgba(139, 92, 246, 0.4);
  color: var(--adv-text-primary);
}

.world-view-btn.active {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.4);
  color: #8b5cf6;
  font-weight: 600;
}

:root.dark .world-view-btn {
  background: var(--adv-surface-elevated, #252536);
  border-color: rgba(255, 255, 255, 0.08);
}

:root.dark .world-view-btn.active {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
  color: #a78bfa;
}

.world-events-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border: none;
  background: none;
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  cursor: pointer;
}

.world-events-toggle {
  font-size: 10px;
  color: var(--adv-text-tertiary, #94a3b8);
}

.world-events-list {
  padding: 0 var(--adv-space-md) var(--adv-space-sm);
}

.world-events-loading,
.world-events-empty {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary, #94a3b8);
  padding: var(--adv-space-xs) 0;
}

.world-event-item {
  display: flex;
  align-items: flex-start;
  gap: var(--adv-space-xs, 4px);
  padding: 3px 0;
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-secondary);
}

.world-event-icon {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1.5;
}

.world-event-summary {
  line-height: 1.5;
}
</style>
