<script setup lang="ts">
import { useAdvContext, useAppStore } from '@advjs/client'

withDefaults(defineProps<{
  showHelper?: boolean
}>(), {
  showHelper: true,
})

const { $adv } = useAdvContext()
const app = useAppStore()

// audio.setBgm($adv.gameConfig.value.bgm?.collection[0]?.src)
</script>

<template>
  <!-- 渐变黑色背景 -->
  <div
    class="adv-game-ui--header absolute top-0 w-full flex justify-between" p="5"
  >
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

      <AdvIconButton @click="$adv.$bgm.toggleMute()">
        <div v-if="!$adv.$bgm.isMuted.value" i-mdi-music-note-outline />
        <div v-else i-mdi-music-note-off-outline />
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
</style>
