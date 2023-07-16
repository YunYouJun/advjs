<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// 文字播放预览
import type { AdvItemOption, AdvMenuItemProps } from '@advjs/theme-default'
import { useSettingsStore } from '~/stores/settings'
import type { DisplayFontSize, DisplayMode, DisplaySpeed } from '~/stores/settings'

const settings = useSettingsStore()

const { t } = useI18n()

const words = ref(t('settings.example_text'))
watch(() => t('settings.example_text'), (val) => {
  words.value = val
})

const endIntervalId = ref()

function triggerPrintWords() {
  if (endIntervalId.value)
    clearInterval(endIntervalId.value)

  words.value = ''
  setTimeout(() => {
    words.value = t('settings.example_text')
  }, 0)
}

/**
 * 终止时继续播放
 */
function onEnd() {
  if (endIntervalId.value)
    clearInterval(endIntervalId.value)

  endIntervalId.value = setTimeout(() => {
    triggerPrintWords()
  }, 2000)
}

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

  <div col="span-12" class="animate__animated animate__slideInDown">
    <div class="h-26" :class="`text-${settings.storage.text.curFontSize}`" text="left" bg="gray-500 opacity-20" p="4">
      <PrintWords :speed="settings.storage.text.curSpeed" :mode="settings.storage.text.curDisplayMode" :words="words" @end="onEnd" />
    </div>
  </div>
</template>
