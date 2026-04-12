<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { useI18n } from 'vue-i18n'

defineProps<{
  characters: AdvCharacter[]
}>()

const emit = defineEmits<{
  selectCharacter: [character: { id: string }]
}>()

const { t } = useI18n()
</script>

<template>
  <aside class="world-sidebar" role="navigation" :aria-label="t('world.viewAllCharacters')">
    <div class="world-sidebar__header">
      👥 {{ t('world.viewAllCharacters') }}
    </div>
    <div class="world-sidebar__list" role="list">
      <button
        v-for="char in characters"
        :key="char.id"
        class="world-sidebar__char"
        role="listitem"
        :aria-label="char.name"
        @click="emit('selectCharacter', char)"
      >
        <span class="world-sidebar__avatar">{{ char.name?.slice(0, 2) || '?' }}</span>
        <span class="world-sidebar__info">
          <span class="world-sidebar__name">{{ char.name }}</span>
          <span v-if="char.faction" class="world-sidebar__faction">{{ char.faction }}</span>
        </span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.world-sidebar {
  border-right: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.08));
  overflow-y: auto;
  padding: var(--adv-space-sm) 0;
}

:root.dark .world-sidebar {
  border-right-color: rgba(255, 255, 255, 0.06);
}

.world-sidebar__header {
  padding: var(--adv-space-sm) var(--adv-space-md);
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  color: var(--adv-text-secondary);
}

.world-sidebar__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 var(--adv-space-xs);
}

.world-sidebar__char {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md);
  border: none;
  background: transparent;
  border-radius: var(--adv-radius-md, 8px);
  cursor: pointer;
  text-align: left;
  min-height: 48px;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.world-sidebar__char:hover {
  background: var(--adv-surface-elevated, #f5f5f5);
}

:root.dark .world-sidebar__char:hover {
  background: var(--adv-surface-elevated, #2a2a3e);
}

.world-sidebar__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--adv-gradient-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.world-sidebar__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.world-sidebar__name {
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 500;
  color: var(--adv-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.world-sidebar__faction {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary);
}
</style>
