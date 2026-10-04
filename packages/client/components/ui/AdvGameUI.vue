<script setup lang="ts">
import { useAdvContext, useAppStore } from '@advjs/client'
import { onClickOutside, useFullscreen } from '@vueuse/core'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useGameControlsI18n } from '../../composables/useGameControlsI18n'
import QuickSaveControls from '../save/QuickSaveControls.vue'

withDefaults(defineProps<{ showHelper?: boolean }>(), { showHelper: true })

const { $adv } = useAdvContext()
const app = useAppStore()
const router = useRouter()
const { t } = useGameControlsI18n()
const open = shallowRef(false)
const root = useTemplateRef<HTMLElement>('root')
const screen = computed(() => root.value?.closest<HTMLElement>('.adv-screen'))
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(screen)
onClickOutside(root, () => {
  open.value = false
})

function openSettings() {
  open.value = false
  app.menus.settings = true
}
</script>

<template>
  <div ref="root" class="adv-game-menu" @keydown.esc.stop="open = false">
    <button type="button" class="game-menu-trigger" :aria-expanded="open" @click="open = !open">
      {{ t('controls.more') }}
    </button>
    <div v-show="open" class="game-menu-popover" :aria-label="t('controls.more')">
      <QuickSaveControls show-labels />
      <button type="button" @click="openSettings">
        {{ t('controls.settings') }}
      </button>
      <button type="button" :aria-pressed="$adv.$bgm.isMuted.value" @click="$adv.$bgm.toggleMute()">
        {{ t($adv.$bgm.isMuted.value ? 'controls.unmute' : 'controls.mute') }}
      </button>
      <button type="button" :aria-pressed="!app.showTachie" @click="app.toggleTachie()">
        {{ t(app.showTachie ? 'controls.hideCharacters' : 'controls.showCharacters') }}
      </button>
      <button v-if="$adv.gameConfig.value.gallery" type="button" @click="router.push('/gallery')">
        {{ t('controls.gallery') }}
      </button>
      <template v-if="showHelper">
        <button type="button" @click="app.rotate()">
          {{ t('controls.rotate') }}
        </button>
        <button type="button" @click="toggleFullscreen()">
          {{ t(isFullscreen ? 'controls.exitFullscreen' : 'controls.fullscreen') }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.adv-game-menu {
  position: relative;
}

.game-menu-trigger,
.game-menu-popover > button {
  min-height: calc(28px / var(--adv-screen-scale, 1));
  padding: 0.25em 0.65em;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.game-menu-trigger:hover,
.game-menu-trigger:focus-visible,
.game-menu-popover > button:hover,
.game-menu-popover > button:focus-visible {
  background: rgb(255 255 255 / 12%);
  outline: 1px solid currentColor;
}

.game-menu-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.5em);
  display: flex;
  flex-direction: column;
  min-width: 12em;
  max-height: calc(var(--adv-screen-height, 100vh) - 5em);
  overflow-y: auto;
  padding: 0.5em;
  border: 1px solid rgb(217 189 131 / 30%);
  border-radius: 0.5em;
  background: rgb(24 23 21 / 97%);
  box-shadow: 0 0.5em 2em rgb(0 0 0 / 35%);
}

.game-menu-popover > button {
  text-align: left;
}
</style>
