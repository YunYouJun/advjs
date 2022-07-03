<script setup lang="ts">
import { useAdvCtx } from '~/setup'
import { useAppStore } from '~/stores/app'
import { useAudioStore } from '~/stores/audio'
const $adv = useAdvCtx()

const app = useAppStore()
const audio = useAudioStore()

audio.setBgm($adv.config.bgm.collection[0]?.src)
</script>

<template>
  <div class="flex absolute top-5 justify-between w-full" p="x-5">
    <div class="inline-flex" gap="4">
      <AdvIconButton @click="app.toggleHistory()">
        <div i-ri-message-2-line />
      </AdvIconButton>

      <AdvIconButton @click="app.toggleUi()">
        <div i-ri-eye-close-line />
      </AdvIconButton>

      <AdvIconButton @click="app.toggleTachie()">
        <div v-if="app.showTachie" i-ri-file-user-line />
        <div v-else i-ri-file-user-fill />
      </AdvIconButton>

      <AdvIconButton @click="audio.toggleBgm()">
        <div v-if="audio.curBgm.isPlaying" i-mdi-music-note-outline />
        <div v-else i-mdi-music-note-off-outline />
      </AdvIconButton>

      <AdvHelper text="white" />
      <AdvFullscreenBtn />
    </div>

    <AdvIconButton class="menu-setting-button" @click="app.toggleShowMenu()">
      <div i-ri-settings-3-line />
    </AdvIconButton>

    <AdvModal :show="app.showMenu" @close="app.toggleShowMenu">
      <MenuPanel />
    </AdvModal>

    <AdvModal header="存储存档" :show="app.showSaveMenu" @close="app.toggleShowSaveMenu">
      <SaveMenu />
    </AdvModal>

    <AdvModal header="加载存档" :show="app.showLoadMenu" @close="app.toggleShowLoadMenu">
      <LoadMenu />
    </AdvModal>
  </div>
</template>
