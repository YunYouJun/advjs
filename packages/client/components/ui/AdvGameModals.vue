<script setup lang="ts">
import { useAppStore } from '@advjs/client'
import { useGameControlsI18n } from '../../composables/useGameControlsI18n'

const app = useAppStore()
const { t } = useGameControlsI18n()
</script>

<template>
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
</template>
