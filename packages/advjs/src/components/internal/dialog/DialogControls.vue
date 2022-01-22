<template>
  <div class="dialog-controls">
    <AdvIconButton title="快速存档">
      <i-ri-save-line />
    </AdvIconButton>
    <AdvIconButton title="存储存档" @click="app.toggleShowSaveMenu()">
      <i-ri-folder-download-line />
    </AdvIconButton>
    <AdvIconButton title="加载存档" @click="openLoadMenu">
      <i-ri-folder-upload-line />
    </AdvIconButton>
  </div>
</template>

<script lang="ts" setup>
import { useAppStore } from '~/stores/app'

const app = useAppStore()

const openLoadMenu = () => {
  app.toggleShowLoadMenu()
}
</script>
