<template>
  <MenuItem :item="playSpeedItem" />
  <MenuItem :item="fontSizeItem" />
  <MenuItem :item="displayModeItem" />

  <div col="span-12" class="animate-animated animate-slideInDown">
    <div class="h-26" :class="`text-${settings.storage.text.curFontSize}`" text="left" bg="gray-500 opacity-20" p="4">
      <PrintWords :speed="settings.storage.text.curSpeed" :mode="settings.storage.text.curDisplayMode" :words="words" @end="onEnd" />
    </div>
  </div>
</template>

<script lang="ts" setup>
// 文字播放预览
import type { AdvItemOption, AdvMenuItemProps } from '@advjs/theme-default'
import { useSettingsStore } from '~/stores/settings'
import type { DisplayFontSize, DisplayMode, DisplaySpeed } from '~/stores/settings'

const settings = useSettingsStore()

const exampleText = '这里是一大段长长的预览文本～您可以通过上述选项对其进行调节。'
const words = ref(exampleText)

const endIntervalId = ref()

const triggerPrintWords = () => {
  if (endIntervalId.value)
    clearInterval(endIntervalId.value)

  words.value = ''
  setTimeout(() => {
    words.value = exampleText
  }, 0)
}

/**
 * 终止时继续播放
 */
const onEnd = () => {
  if (endIntervalId.value)
    clearInterval(endIntervalId.value)

  endIntervalId.value = setTimeout(() => {
    triggerPrintWords()
  }, 2000)
}

interface SpeedOption extends AdvItemOption {
  value: DisplaySpeed
}
const speedOptions: SpeedOption[] = [
  {
    label: '慢',
    value: 'slow',
  },
  {
    label: '中',
    value: 'normal',
  },
  {
    label: '快',
    value: 'fast',
  },
]

const playSpeedItem = computed<AdvMenuItemProps<'RadioGroup', SpeedOption>>(() => ({
  label: '播放速度',
  type: 'RadioGroup',
  props: {
    checked: settings.storage.text.curSpeed,
    options: speedOptions,
    onClick(option) {
      settings.storage.text.curSpeed = option.value
      triggerPrintWords()
    },
  },
}))

interface FontSizeOption extends AdvItemOption {
  value: DisplayFontSize
}
const fontSizeOptions: FontSizeOption[] = [
  {
    label: '小',
    value: 'xl',
  },
  {
    label: '中',
    value: '2xl',
  },
  {
    label: '大',
    value: '3xl',
  },
]
const fontSizeItem = computed<AdvMenuItemProps<'RadioGroup', FontSizeOption>>(() => ({
  label: '字体大小',
  type: 'RadioGroup',
  props: {
    checked: settings.storage.text.curFontSize,
    options: fontSizeOptions,
    onClick(options) {
      settings.storage.text.curFontSize = options.value
    },
  },
}))

interface DisplayModeOption extends AdvItemOption {
  value: DisplayMode
}
const displayModeOptions: DisplayModeOption[] = [
  {
    label: '打字模式',
    value: 'type',
  },
  {
    label: '轻柔模式',
    value: 'soft',
  },
]
const displayModeItem = computed<AdvMenuItemProps<'RadioGroup', DisplayModeOption>>(() => ({
  label: '显示模式',
  type: 'RadioGroup',
  props: {
    checked: settings.storage.text.curDisplayMode,
    options: displayModeOptions,
    onClick(option) {
      settings.storage.text.curDisplayMode = option.value
    },
  },
}))
</script>
