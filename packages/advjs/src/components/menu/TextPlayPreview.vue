<template>
  <MenuItem :item="playSpeedItem">
    <!-- <AdvRadioGroup v-model:checked="curSpeed" :options="playSpeedItem.props.options" /> -->
  </MenuItem>

  <div col="span-12" class="animate-animated animate-slideInDown">
    <div class="h-24" text="left" bg="gray-500 opacity-20" p="4">
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

</script>

<style lang="scss">
@use "sass:map";
@use "@advjs/theme-default/styles/vars.scss" as *;

.adv-text-button {
  padding: 0.2rem 0.5rem;
  border: 2px solid transparent;
  transition: 0.2s;

  &:hover {
    cursor: pointer;
    border-bottom: 2px solid map.get($adv-colors, 'primary');
  }

  &.active {
    border-bottom: 2px solid map.get($adv-colors, 'primary');
    background-color: rgba(map.get($adv-colors, 'primary'), 0.1);
  }
}
</style>
