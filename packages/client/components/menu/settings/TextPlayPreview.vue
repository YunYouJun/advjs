<script lang="ts" setup>
import type { DisplayFontSize, DisplayMode, DisplaySpeed } from '@advjs/client'
// 文字播放预览
import type { AdvItemOption, AdvMenuItemProps } from '@advjs/theme-default'

import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores'

const settings = useSettingsStore()

const { t } = useI18n()

const words = ref(t('settings.example_text'))
watch(() => t('settings.example_text'), (val) => {
  words.value = val
})

let endTimer: ReturnType<typeof setTimeout> | undefined
let restartTimer: ReturnType<typeof setTimeout> | undefined

function triggerPrintWords() {
  clearTimeout(endTimer)

  words.value = ''
  clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    words.value = t('settings.example_text')
  }, 0)
}

/**
 * 终止时继续播放
 */
function onEnd() {
  clearTimeout(endTimer)

  endTimer = setTimeout(() => {
    triggerPrintWords()
  }, 2000)
}

onUnmounted(() => {
  clearTimeout(endTimer)
  clearTimeout(restartTimer)
})

interface SpeedOption extends AdvItemOption {
  value: DisplaySpeed
}
const playSpeedItem = computed<AdvMenuItemProps<'RadioGroup', SpeedOption>>(() => ({
  label: t('settings.play_speed'),
  type: 'RadioGroup',
  props: {
    checked: settings.storage.text.curSpeed,
    options: [
      {
        label: t('play_speed.slow'),
        value: 'slow',
      },
      {
        label: t('play_speed.normal'),
        value: 'normal',
      },
      {
        label: t('play_speed.fast'),
        value: 'fast',
      },
      {
        label: t('play_speed.very_fast'),
        value: 'very_fast',
      },
    ],
    onClick(option) {
      settings.storage.text.curSpeed = option.value
      triggerPrintWords()
    },
  },
}))

interface FontSizeOption extends AdvItemOption {
  value: DisplayFontSize
}
const fontSizeItem = computed<AdvMenuItemProps<'RadioGroup', FontSizeOption>>(() => ({
  label: t('settings.font_size'),
  type: 'RadioGroup',
  props: {
    checked: settings.storage.text.curFontSize,
    options: [
      {
        label: t('font_size.small'),
        value: 'xl',
      },
      {
        label: t('font_size.normal'),
        value: '2xl',
      },
      {
        label: t('font_size.big'),
        value: '3xl',
      },
      {
        label: t('font_size.extra_large'),
        value: '4xl',
      },
    ],
    onClick(options) {
      settings.storage.text.curFontSize = options.value
    },
  },
}))

interface DisplayModeOption extends AdvItemOption {
  value: DisplayMode
}
const displayModeItem = computed<AdvMenuItemProps<'RadioGroup', DisplayModeOption>>(() => ({
  label: t('settings.display_mode'),
  type: 'RadioGroup',
  props: {
    checked: settings.storage.text.curDisplayMode,
    options: [
      {
        label: t('display_mode.type'),
        value: 'type',
      },
      {
        label: t('display_mode.soft'),
        value: 'soft',
      },
    ],
    onClick(option) {
      settings.storage.text.curDisplayMode = option.value
    },
  },
}))
</script>

<template>
  <MenuItem :item="playSpeedItem" />
  <MenuItem :item="fontSizeItem" />
  <MenuItem :item="displayModeItem" />

  <div class="adv-settings-reading-sample">
    <div class="adv-dialog-reading" :class="`text-${settings.storage.text.curFontSize}`">
      <PrintWords :speed="settings.storage.text.curSpeed" :mode="settings.storage.text.curDisplayMode" :words="words" @end="onEnd" />
    </div>
  </div>
</template>

<style scoped>
.adv-settings-reading-sample {
  grid-column: 1 / -1;
  margin-top: 0.5em;
  background: color-mix(in srgb, var(--adv-c-text) 6%, transparent);
  border-radius: calc(var(--adv-control-radius, 4px) / var(--adv-screen-scale, 1));
}

.adv-settings-reading-sample .adv-dialog-reading {
  box-sizing: border-box;
  height: calc(96px / var(--adv-screen-scale, 1));
  padding: calc(12px / var(--adv-screen-scale, 1));
  overflow: auto;
  text-align: left;
}
</style>
