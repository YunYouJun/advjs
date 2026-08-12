<script setup lang="ts">
import { useAdvContext, useAppStore } from '@advjs/client'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

withDefaults(defineProps<{
  showHelper?: boolean
}>(), {
  showHelper: true,
})

const { $adv } = useAdvContext()
const app = useAppStore()
const router = useRouter()
const { t } = useI18n()

// audio.setBgm($adv.gameConfig.value.bgm?.collection[0]?.src)
</script>

<template>
  <!-- 渐变黑色背景 -->
  <div
    class="adv-game-ui--header flex w-full top-0 justify-between absolute" p="5"
  >
    <div class="adv-game-ui--actions inline-flex" gap="4">
      <AdvIconButton @click="app.toggleHistory()">
        <div i-ri-message-2-line />
      </AdvIconButton>

      <AdvIconButton :title="t('menu.save_game')" @click="app.toggleShowSaveMenu()">
        <div i-ri-folder-download-line />
      </AdvIconButton>

      <AdvIconButton :title="t('menu.load_game')" @click="app.toggleShowLoadMenu()">
        <div i-ri-folder-upload-line />
      </AdvIconButton>

      <AdvIconButton @click="app.toggleUi()">
        <div i-ri-eye-close-line />
      </AdvIconButton>

      <AdvIconButton @click="app.toggleTachie()">
        <div v-if="app.showTachie" i-ri-file-user-line />
        <div v-else i-ri-file-user-fill />
      </AdvIconButton>

      <AdvIconButton @click="$adv.$bgm.toggleMute()">
        <div v-if="!$adv.$bgm.isMuted.value" i-mdi-music-note-outline />
        <div v-else i-mdi-music-note-off-outline />
      </AdvIconButton>

      <AdvIconButton :title="$adv.$auto.enabled.value ? 'Auto: ON' : 'Auto: OFF'" @click="$adv.$auto.toggle()">
        <div v-if="$adv.$auto.enabled.value" i-ri-play-circle-fill class="text-green-400" />
        <div v-else i-ri-play-circle-line />
      </AdvIconButton>

      <AdvIconButton :title="$adv.$auto.skipEnabled.value ? 'Skip: ON' : 'Skip: OFF'" @click="$adv.$auto.toggleSkip()">
        <div v-if="$adv.$auto.skipEnabled.value" i-ri-skip-forward-fill class="text-yellow-400" />
        <div v-else i-ri-skip-forward-line />
      </AdvIconButton>

      <AdvIconButton v-if="$adv.gameConfig.value.gallery" title="CG 回廊" @click="router.push('/gallery')">
        <div i-ri-gallery-line />
      </AdvIconButton>

      <template v-if="showHelper">
        <AdvHelper text="white" />
        <AdvFullscreenBtn />
      </template>
    </div>

    <AdvIconButton class="menu-setting-button" @click="app.menus.settings = true">
      <div i-ri-settings-3-line />
    </AdvIconButton>
  </div>
</template>

<style lang="scss">
.adv-game-ui--header {
  background: linear-gradient(0deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5));
}

@media (max-width: 800px) {
  .adv-game-ui--header {
    box-sizing: border-box;
    gap: 0.5rem;
  }

  .adv-game-ui--actions {
    min-width: 0;
    flex: 1 1 auto;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .adv-game-ui--actions::-webkit-scrollbar {
    display: none;
  }

  .adv-game-ui--actions > .adv-icon-button,
  .adv-game-ui--header > .menu-setting-button {
    flex: 0 0 auto;
  }
}
</style>
