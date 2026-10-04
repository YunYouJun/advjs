<script setup lang="ts">
import { useAdvContext, useAppStore } from '@advjs/client'
import { useGameControlsI18n } from '../../../composables/useGameControlsI18n'
import AdvGameUI from '../../ui/AdvGameUI.vue'

const { $adv } = useAdvContext()
const app = useAppStore()
const { t } = useGameControlsI18n()
</script>

<template>
  <nav class="dialog-controls" :aria-label="t('controls.label')" @click.stop @pointerdown.stop>
    <button type="button" class="dialog-control" @click="app.toggleHistory()">
      {{ t('controls.history') }}
    </button>
    <button type="button" class="dialog-control" :aria-pressed="$adv.$auto.enabled.value" @click="$adv.$auto.toggle()">
      {{ t('controls.auto') }}
    </button>
    <button type="button" class="dialog-control" :aria-pressed="$adv.$auto.skipEnabled.value" @click="$adv.$auto.toggleSkip()">
      {{ t('controls.skip') }}
    </button>
    <button type="button" class="dialog-control" @click="app.toggleShowSaveMenu()">
      {{ t('controls.save') }}
    </button>
    <button type="button" class="dialog-control" @click="app.toggleShowLoadMenu()">
      {{ t('controls.load') }}
    </button>
    <button type="button" class="dialog-control" @click="app.toggleUi()">
      {{ t('controls.hide') }}
    </button>
    <AdvGameUI />
  </nav>
</template>

<style scoped>
.dialog-controls {
  position: absolute;
  right: calc(16px / var(--adv-screen-scale, 1));
  bottom: calc(8px / var(--adv-screen-scale, 1));
  left: calc(16px / var(--adv-screen-scale, 1));
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: calc(3px / var(--adv-screen-scale, 1));
  color: #eee8dd;
  font-size: calc(12px / var(--adv-screen-scale, 1));
}

.dialog-control {
  min-height: calc(28px / var(--adv-screen-scale, 1));
  padding: 0.25em 0.65em;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.dialog-control:hover,
.dialog-control:focus-visible {
  background: rgb(255 255 255 / 12%);
  outline: 1px solid currentColor;
}

.dialog-control[aria-pressed='true'] {
  border-color: #d9bd83;
  color: #f1d8a4;
  background: rgb(217 189 131 / 12%);
}
</style>
