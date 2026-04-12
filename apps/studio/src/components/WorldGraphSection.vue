<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RelationshipGraph from './RelationshipGraph.vue'

defineProps<{
  characters: AdvCharacter[]
}>()

const emit = defineEmits<{
  selectCharacter: [characterId: string]
}>()

const { t } = useI18n()
const showGraph = ref(false)
</script>

<template>
  <div class="world-graph-section">
    <button
      class="world-graph-toggle"
      @click="showGraph = !showGraph"
    >
      <span>🔗 {{ showGraph ? t('world.hideGraph') : t('world.showGraph') }}</span>
      <span class="world-graph-toggle-icon">{{ showGraph ? '▼' : '▶' }}</span>
    </button>
    <Transition name="fade">
      <RelationshipGraph
        v-if="showGraph"
        :characters="characters"
        @select-character="(id: string) => emit('selectCharacter', id)"
      />
    </Transition>
  </div>
</template>

<style scoped>
.world-graph-section {
  margin: var(--adv-space-sm) var(--adv-space-md);
  background: var(--adv-surface-card, #fff);
  border-radius: var(--adv-radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

:root.dark .world-graph-section {
  background: var(--adv-surface-card, #1e1e2e);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.world-graph-toggle {
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

.world-graph-toggle-icon {
  font-size: 10px;
  color: var(--adv-text-tertiary, #94a3b8);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
