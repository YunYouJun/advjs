<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCharacterInitials, getValidAvatarUrl } from '../utils/chatUtils'

export interface TimelineFilter {
  kinds: ('event' | 'diary')[]
  characterIds: string[]
  eventTypes: string[]
}

const props = defineProps<{
  modelValue: TimelineFilter
  characters: AdvCharacter[]
  availableEventTypes: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: TimelineFilter]
}>()

const { t } = useI18n()

const EVENT_TYPE_EMOJI: Record<string, string> = {
  daily: '🔵',
  social: '🟢',
  unexpected: '🟠',
  weather: '🌤️',
  manual: '📝',
}

const showEventTypes = computed(
  () => props.modelValue.kinds.length === 0 || props.modelValue.kinds.includes('event'),
)

const showCharacters = computed(() => props.characters.length > 1)

function toggleKind(kind: 'event' | 'diary') {
  const cur = props.modelValue.kinds
  const next = cur.includes(kind) ? cur.filter(k => k !== kind) : [...cur, kind]
  // Clear eventTypes filter if 'event' is being removed
  const eventTypes = next.includes('event') || next.length === 0
    ? props.modelValue.eventTypes
    : []
  emit('update:modelValue', { ...props.modelValue, kinds: next, eventTypes })
}

function toggleEventType(type: string) {
  const cur = props.modelValue.eventTypes
  const next = cur.includes(type) ? cur.filter(t => t !== type) : [...cur, type]
  emit('update:modelValue', { ...props.modelValue, eventTypes: next })
}

function toggleCharacter(id: string) {
  const cur = props.modelValue.characterIds
  const next = cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id]
  emit('update:modelValue', { ...props.modelValue, characterIds: next })
}

function isKindActive(kind: 'event' | 'diary') {
  return props.modelValue.kinds.includes(kind)
}

function isEventTypeActive(type: string) {
  return props.modelValue.eventTypes.includes(type)
}

function isCharacterActive(id: string) {
  return props.modelValue.characterIds.includes(id)
}
</script>

<template>
  <div class="tf">
    <!-- Row 1: kind filter -->
    <div class="tf-row">
      <button
        class="tf-pill"
        :class="{ active: modelValue.kinds.length === 0 }"
        @click="emit('update:modelValue', { ...modelValue, kinds: [], eventTypes: [] })"
      >
        {{ t('world.timelineFilterAll') }}
      </button>
      <button
        class="tf-pill"
        :class="{ active: isKindActive('event') }"
        @click="toggleKind('event')"
      >
        🌍 {{ t('world.timelineFilterEvents') }}
      </button>
      <button
        class="tf-pill"
        :class="{ active: isKindActive('diary') }"
        @click="toggleKind('diary')"
      >
        📓 {{ t('world.timelineFilterDiaries') }}
      </button>
    </div>

    <!-- Row 2: event type filter (only when events are visible) -->
    <div v-if="showEventTypes && availableEventTypes.length > 0" class="tf-row">
      <button
        v-for="type in availableEventTypes"
        :key="type"
        class="tf-pill tf-pill--sm"
        :class="{ active: isEventTypeActive(type) }"
        @click="toggleEventType(type)"
      >
        {{ EVENT_TYPE_EMOJI[type] || '🔵' }} {{ type }}
      </button>
    </div>

    <!-- Row 3: character filter -->
    <div v-if="showCharacters" class="tf-row">
      <button
        v-for="char in characters"
        :key="char.id"
        class="tf-pill tf-pill--char"
        :class="{ active: isCharacterActive(char.id) }"
        @click="toggleCharacter(char.id)"
      >
        <img
          v-if="getValidAvatarUrl(char.avatar)"
          :src="getValidAvatarUrl(char.avatar)"
          class="tf-avatar"
          alt=""
        >
        <span v-else class="tf-initials">{{ getCharacterInitials(char.name) }}</span>
        {{ char.name || char.id }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tf {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--adv-space-xs) var(--adv-space-md);
}

.tf-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.tf-row::-webkit-scrollbar {
  display: none;
}

.tf-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--adv-border-subtle, #e2e8f0);
  background: var(--adv-surface-elevated, #f8fafc);
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-caption, 11px);
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.tf-pill:hover {
  border-color: rgba(139, 92, 246, 0.4);
  color: var(--adv-text-primary);
}

.tf-pill.active {
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.5);
  color: #8b5cf6;
  font-weight: 600;
}

:root.dark .tf-pill {
  background: var(--adv-surface-elevated, #252536);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--adv-text-secondary);
}

:root.dark .tf-pill.active {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.5);
  color: #a78bfa;
}

.tf-pill--sm {
  font-size: 10px;
  padding: 3px 8px;
}

.tf-pill--char {
  padding: 3px 8px 3px 4px;
}

.tf-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.tf-initials {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
