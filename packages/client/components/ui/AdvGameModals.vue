<script setup lang="ts">
import { useAppStore } from '@advjs/client'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const app = useAppStore()
</script>

<template>
  <AdvModal
    v-model:open="app.showHistory"
    :header="t('ui.history')" icon="i-ri-history-line"
  >
    <AdvHistory />
  </AdvModal>

  <AdvModal
    v-model:open="app.menus.settings"
    :label="t('menu.settings')"
  >
    <AdvSettingsPanel />
  </AdvModal>

  <AdvModal
    v-model:open="app.showSaveMenu"
    :header="t('menu.save_game')"
    icon="i-ri-save-line"
  >
    <SaveMenu />
  </AdvModal>

  <AdvModal
    v-model:open="app.showLoadMenu"
    :header="t('menu.load_game')"
    icon="i-ri-folder-upload-line"
  >
    <LoadMenu />
  </AdvModal>
</template>
