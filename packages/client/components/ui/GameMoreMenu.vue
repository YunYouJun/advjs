<script setup lang="ts">
import { useAdvContext, useAppStore } from '@advjs/client'
import { onClickOutside } from '@vueuse/core'
import { shallowRef, useId, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameControlsI18n } from '../../composables/useGameControlsI18n'
import QuickSaveControls from '../save/QuickSaveControls.vue'
import GameIconButton from './GameIconButton.vue'

withDefaults(defineProps<{ showHelper?: boolean }>(), { showHelper: true })
const { $adv } = useAdvContext()
const app = useAppStore()
const router = useRouter()
const { t } = useGameControlsI18n()
const open = shallowRef(false)
const root = useTemplateRef<HTMLElement>('root')
const panelId = useId()

function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus)
    root.value?.querySelector<HTMLButtonElement>('.game-icon-button')?.focus()
}

onClickOutside(root, (event) => {
  if (!open.value)
    return
  close()
  // Dismissing the menu must not also advance dialogue or choose an option.
  const target = event.target as Element | null
  if (target?.closest('.adv-screen') === root.value?.closest('.adv-screen')
    && !target?.closest('.game-toolbar-actions, .dialog-controls-shell')) {
    event.stopPropagation()
  }
})
watch(() => app.showUi && !app.menus.settings && !app.showHistory && !app.showSaveMenu && !app.showLoadMenu, (visible) => {
  if (!visible)
    close()
})
</script>

<template>
  <div ref="root" class="game-more-menu" @keydown.esc.stop.prevent="close(true)">
    <GameIconButton :label="t('controls.more')" :description="t('hints.more')" :aria-expanded="open" :aria-controls="panelId" @click="open = !open">
      <span i-ri-more-line />
    </GameIconButton>
    <div v-show="open" :id="panelId" class="game-menu-popover" role="group" :aria-label="t('controls.more')">
      <QuickSaveControls show-labels />
      <button type="button" :aria-pressed="!app.showTachie" @click="app.toggleTachie()">
        {{ t(app.showTachie ? 'controls.hideCharacters' : 'controls.showCharacters') }}
      </button>
      <button v-if="$adv.gameConfig.value.gallery" type="button" @click="close(); router.push('/gallery')">
        {{ t('controls.gallery') }}
      </button>
      <button v-if="showHelper" type="button" @click="close(); app.rotate()">
        {{ t('controls.rotate') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.game-menu-popover {
  box-sizing: border-box;
  position: absolute;
  top: calc(var(--adv-toolbar-top) + var(--adv-toolbar-target) + 8px);
  right: var(--adv-toolbar-right);
  display: flex;
  flex-direction: column;
  width: min(224px, calc(100% - var(--adv-toolbar-right) - var(--adv-toolbar-left)));
  max-height: calc(100% - var(--adv-toolbar-top) - var(--adv-toolbar-target) - 20px - env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px;
  border: 1px solid rgb(217 189 131 / 35%);
  border-radius: 10px;
  background: rgb(24 23 21 / 97%);
  box-shadow: 0 6px 24px rgb(0 0 0 / 35%);
  font-size: 14px;
}

.game-menu-popover > button,
.game-menu-popover :deep(.quick-save-controls > button) {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
}

.game-menu-popover > button:hover,
.game-menu-popover > button:focus-visible {
  background: rgb(255 255 255 / 12%);
  outline: 1px solid currentColor;
}
</style>
