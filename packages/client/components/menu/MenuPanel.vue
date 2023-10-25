<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { useScreenLock, useSettingsStore } from '@advjs/client'
import type { AdvMenuItemProps } from '@advjs/theme-default'

import { computed } from 'vue'
import AudioVolume from './settings/AudioVolume.vue'

const { t } = useI18n()

const { orientation, toggle } = useScreenLock()
const { isFullscreen, enter, exit } = useFullscreen()

const settings = useSettingsStore()
const items = computed(() => {
  return [
    {
      type: 'Checkbox',
      label: t('settings.landscape'),
      props: {
        checked: orientation.value === 'landscape',
        onClick: async () => {
          if (isFullscreen.value) {
            await exit()
            toggle('portrait')
          }
          else {
            await enter()
            toggle('landscape')
          }
        },
      },
    },
    {
      label: t('settings.fullscreen'),
      type: 'Checkbox',
      props: {
        checked: isFullscreen.value,
        onClick: settings.toggleFullScreen,
      },
    },
  ] as AdvMenuItemProps[]
})
</script>

<template>
  <div class="menu-panel grid grid-cols-24" gap="0" h="full" text="2xl">
    <div col="span-18" class="overflow-y-scroll">
      <div grid="~ cols-12 gap-5" p="4">
        <h1
          col="span-12"
          class="adv-font-serif font-black"
          text="4xl"
        >
          {{ t('settings.title') }}
        </h1>

        <HorizontalDivider />

        <TextPlayPreview />

        <HorizontalDivider />

        <MenuItem v-for="(item, i) in items" :key="i" :item="item" />

        <HorizontalDivider />
        <AudioVolume />

        <SpeechSynthesis />

        <HorizontalDivider />

        <ToggleSourceMd />

        <HorizontalDivider />

        <GameSettings />
      </div>

      <!-- <div h="full" border="gray right-2" /> -->
    </div>

    <RightTools />

    <!-- <div col="span-1" class="flex justify-center items-center" /> -->
  </div>
</template>
