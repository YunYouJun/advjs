<template>
  <MenuItem :item="playSpeedItem" />
  <MenuItem :item="fontSizeItem" />
  <MenuItem :item="displayModeItem" />

  <div col="span-12" class="animate-animated animate-slideInDown">
    <div class="h-26" :class="`text-${settings.storage.text.curFontSize}`" text="left" bg="gray-500 opacity-20" p="4">
      <PrintWords :type-interval="interval" :mode="settings.storage.text.curDisplayMode" :words="words" @end="onEnd" />
    </div>
  </div>
</template>

<script lang="ts" setup>
// 文字播放预览
import type { AdvMenuItemProps } from '@advjs/theme-default'
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

const speedOptions = [
  {
    label: '慢',
    value: 'slow',
    interval: 100,
  },
  {
    label: '中',
    value: 'normal',
    interval: 50,
  },
  {
    label: '快',
    value: 'fast',
    interval: 25,
  },
]

const interval = ref((speedOptions.find(item => item.value === settings.storage.text.curSpeed) || { interval: 50 }).interval)

const playSpeedItem = computed<AdvMenuItemProps<'RadioGroup'>>(() => ({
  label: '播放速度',
  type: 'RadioGroup',
  props: {
    checked: settings.storage.text.curSpeed,
    options: speedOptions,
    onClick(val: DisplaySpeed) {
      settings.storage.text.curSpeed = val
      interval.value = speedOptions.find(item => item.value === val)?.interval || 50

      triggerPrintWords()
    },
  },
}))

const fontSizeItem = computed<AdvMenuItemProps<'RadioGroup'>>(() => ({
  label: '字体大小',
  type: 'RadioGroup',
  props: {
    checked: settings.storage.text.curFontSize,
    options: [
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
    ],
    onClick(val: DisplayFontSize) {
      settings.storage.text.curFontSize = val
    },
  },
}))

const displayModeItem = computed<AdvMenuItemProps<'RadioGroup'>>(() => ({
  label: '显示模式',
  type: 'RadioGroup',
  props: {
    checked: settings.storage.text.curDisplayMode,
    options: [
      {
        label: '打字模式',
        value: 'type',
      },
      {
        label: '轻柔模式',
        value: 'soft',
      },
    ],
    onClick(val: DisplayMode) {
      settings.storage.text.curDisplayMode = val
    },
  },
}))
</script>
