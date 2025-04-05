<script lang="ts" setup>
import { useAppStore } from '@advjs/client'
import { screenshotGame } from '@advjs/core'

const app = useAppStore()

async function doScreenshot() {
  screenshotGame()
}

function openLoadMenu() {
  app.toggleShowLoadMenu()
}
</script>

<template>
  <div class="dialog-controls flex justify-center">
    <AdvIconButton title="快速存档">
      <div i-ri-save-line />
    </AdvIconButton>
    <AdvIconButton title="截屏" @click="doScreenshot">
      <div i-ri-screenshot-line />
    </AdvIconButton>
    <AdvIconButton title="存储存档" @click="app.toggleShowSaveMenu()">
      <div i-ri-folder-download-line />
    </AdvIconButton>
    <AdvIconButton title="加载存档" @click="openLoadMenu">
      <div i-ri-folder-upload-line />
    </AdvIconButton>
  </div>
</template>
