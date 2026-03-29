<script setup lang="ts">
import type { ViewMode } from '../stores/useViewModeStore'
import { useI18n } from 'vue-i18n'
import { useViewModeStore } from '../stores/useViewModeStore'

const { t } = useI18n()
const viewModeStore = useViewModeStore()

const modes: { key: ViewMode, emoji: string, labelKey: string }[] = [
  { key: 'character', emoji: '🎮', labelKey: 'world.viewModeCharacter' },
  { key: 'god', emoji: '👁️', labelKey: 'world.viewModeGod' },
  { key: 'visitor', emoji: '💬', labelKey: 'world.viewModeVisitor' },
]
</script>

<template>
  <div class="view-mode-switcher">
    <div class="view-mode-label">
      {{ t('world.viewMode') }}
    </div>
    <div class="view-mode-segment">
      <button
        v-for="m in modes"
        :key="m.key"
        class="view-mode-segment__btn"
        :class="{ 'view-mode-segment__btn--active': viewModeStore.mode === m.key }"
        @click="viewModeStore.setMode(m.key)"
      >
        <span class="view-mode-segment__emoji">{{ m.emoji }}</span>
        <span class="view-mode-segment__text">{{ t(m.labelKey) }}</span>
      </button>
    </div>
  </div>
</template>
