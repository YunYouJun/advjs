<script setup lang="ts">
import { useAppStore } from '@advjs/client'

const app = useAppStore()
</script>

<template>
  <AdvModal
    v-model:open="app.showHistory"
    header="历史记录" icon="i-ri-history-line"
    @close="app.toggleHistory"
  >
    <AdvHistory />
  </AdvModal>

  <AdvModal
    v-model:open="app.menus.settings"
    @close="app.menus.settings = false"
  >
    <AdvMenuPanel />
  </AdvModal>

  <AdvModal
    v-model:open="app.showSaveMenu"
    header="存储存档"
    @close="app.toggleShowSaveMenu"
  >
    <SaveMenu />
  </AdvModal>

  <AdvModal
    v-model:open="app.showLoadMenu"
    header="加载存档"
    @close="app.toggleShowLoadMenu"
  >
    <LoadMenu />
  </AdvModal>
</template>
