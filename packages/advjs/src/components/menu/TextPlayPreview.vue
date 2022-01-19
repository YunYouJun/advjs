<template>
  <MenuItem :item="playSpeedItem">
    <span v-for="(item, i) in playSpeedItem.options" :key="i" class="adv-text-button" :class="curSpeed === item.value ? 'active' : ''" m="r-8" @click="curSpeed = item.value">
      {{ item.label }}
    </span>
  </MenuItem>

  <div col="span-12" class="animate-animated animate-slideInDown">
    <div class="h-24" text="left" bg="gray-500 opacity-20" p="4">
      <PrintWords :type-interval="interval" :words="words" @end="onEnd" />
    </div>
  </div>
</template>

<script lang="ts" setup>
// 文字播放预览

const curSpeed = ref('normal')
const exampleText = '这里是一大段长长的预览文本～您可以通过上述选项对其进行调节。'
const words = ref(exampleText)

const triggerPrintWords = () => {
  words.value = ''
  setTimeout(() => {
    words.value = exampleText
  }, 10)
}

const onEnd = () => {
  setTimeout(() => {
    triggerPrintWords()
  }, 1000)
}

const playSpeedItem = {
  label: '播放速度',
  type: '',
  options: [
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
  ],
}

const interval = computed(() => {
  const speed = playSpeedItem.options.find(item => item.value === curSpeed.value)?.interval
  triggerPrintWords()
  return speed
})
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
