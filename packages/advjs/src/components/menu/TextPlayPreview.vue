<template>
  <MenuItem :item="playSpeedItem" />
  <MenuItem :item="fontSizeItem" />

  <div col="span-12" class="animate-animated animate-slideInDown">
    <div class="h-26" :class="`text-${curFontSize}`" text="left" bg="gray-500 opacity-20" p="4">
      <PrintWords :type-interval="interval" :words="words" @end="onEnd" />
    </div>
  </div>
</template>

<script lang="ts" setup>
// 文字播放预览

import type { AdvMenuItemProps } from '@advjs/theme-default'

const curSpeed = ref('normal')

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

const interval = ref((speedOptions.find(item => item.value === curSpeed.value) || { interval: 50 }).interval)

const playSpeedItem = computed<AdvMenuItemProps<'RadioGroup'>>(() => ({
  label: '播放速度',
  type: 'RadioGroup',
  props: {
    checked: curSpeed.value,
    options: speedOptions,
    onClick(val: 'slow' | 'normal' | 'fast') {
      curSpeed.value = val
      interval.value = speedOptions.find(item => item.value === val)?.interval || 50

      triggerPrintWords()
    },
  },
}))

const curFontSize = ref('xl')
const fontSizeItem = computed<AdvMenuItemProps<'RadioGroup'>>(() => ({
  label: '字体大小',
  type: 'RadioGroup',
  props: {
    checked: curFontSize.value,
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
    onClick(val: 'sm' | 'lg' | 'xl') {
      curFontSize.value = val
    },
  },
}))

</script>
