<script setup lang="ts">
import { useAppStore } from '@advjs/client'
import { useGameControlsI18n } from '../../composables/useGameControlsI18n'

const app = useAppStore()
const { t } = useGameControlsI18n()
</script>

<template>
  <div v-if="app.showHistory || app.menus.settings || app.showSaveMenu || app.showLoadMenu" class="game-modal-layer" @click.stop @pointerdown.stop>
    <AdvModal
      v-model:open="app.showHistory"
      :header="t('controls.history')" icon="i-ri-history-line"
      @close="app.toggleHistory"
    >
      <AdvHistory />
    </AdvModal>

    <AdvModal
      v-model:open="app.menus.settings"
      @close="app.menus.settings = false"
    >
      <AdvSettingsPanel />
    </AdvModal>

    <AdvModal
      v-model:open="app.showSaveMenu"
      :header="t('controls.save')"
      @close="app.toggleShowSaveMenu"
    >
      <SaveMenu />
    </AdvModal>

    <AdvModal
      v-model:open="app.showLoadMenu"
      :header="t('controls.load')"
      @close="app.toggleShowLoadMenu"
    >
      <LoadMenu />
    </AdvModal>
  </div>
</template>

<style scoped>
/* Menus use screen pixels rather than inheriting the scene's canvas scale. */
.game-modal-layer {
  position: absolute;
  inset: 0;
  z-index: 1000;
}

.game-modal-layer :deep(.modal-mask) {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left, 0px);
}

.game-modal-layer :deep(.modal-container),
.game-modal-layer :deep(.modal-body) {
  min-height: 0;
}

.game-modal-layer :deep(h1) {
  padding: 12px 16px;
  font-size: 24px;
}

.game-modal-layer :deep(.adv-history-panel) {
  box-sizing: border-box;
  padding: 16px;
}

.game-modal-layer :deep(.adv-history-panel p),
.game-modal-layer :deep(.adv-history-panel span) {
  font-size: 16px;
}
</style>
