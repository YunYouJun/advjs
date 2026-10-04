<script setup lang="ts">
import { useAdvContext, useAppStore } from '@advjs/client'
import { useElementSize } from '@vueuse/core'
import { useTemplateRef, watch } from 'vue'
import { useGameControlsI18n } from '../../../composables/useGameControlsI18n'

const emit = defineEmits<{ resize: [height: number] }>()
const root = useTemplateRef<HTMLElement>('root')
const { height } = useElementSize(root)
watch(height, value => emit('resize', value), { immediate: true })
const { $adv } = useAdvContext()
const app = useAppStore()
const { t } = useGameControlsI18n()
</script>

<template>
  <nav ref="root" class="dialog-controls" :aria-label="t('controls.label')" @click.stop @pointerdown.stop>
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
  </nav>
</template>

<style scoped>
.dialog-controls {
  position: absolute;
  right: var(--adv-control-right, 16px);
  bottom: var(--adv-control-bottom, 8px);
  left: var(--adv-control-left, 16px);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: calc(4px / var(--adv-screen-scale, 1));
  color: #eee8dd;
  font-size: calc(12px / var(--adv-screen-scale, 1));
}

.dialog-control {
  box-sizing: border-box;
  min-width: var(--adv-control-target, 32px);
  min-height: var(--adv-control-target, 32px);
  padding: 0.25em 0.5em;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  touch-action: manipulation;
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

@container (max-width: 600px) {
  .dialog-controls {
    justify-content: center;
    font-size: calc(13px / var(--adv-screen-scale, 1));
  }
}
</style>
