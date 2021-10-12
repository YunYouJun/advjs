<template>
  <div class="menu-panel grid grid-cols-12 gap-16">
    <div class="col-span-12">
      <h1 class="adv-font-serif text-4xl font-black mt-6">
        {{ t('settings.title') }}
      </h1>
    </div>
    <MenuItem label="是否横屏" :item="item" />
    <FullScreen />
    <SpeechSynthesis />
  </div>
</template>

<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { useScreenLock } from '@advjs/shared'
const { t } = useI18n()

const { orientation, toggle } = useScreenLock()
const { isFullscreen, enter, exit } = useFullscreen()

const isLandscape = computed(() => {
  return orientation.value === 'landscape'
})

const item = {
  type: 'checkbox',
  checked: isLandscape,
  click: async() => {
    if (isFullscreen.value) {
      await exit()
      toggle('portrait')
    }
    else {
      await enter()
      toggle('landscape')
    }
  },
}
</script>
