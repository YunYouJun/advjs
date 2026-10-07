<script setup lang="ts">
import type { AdvMenuItemProps } from '@advjs/client'
import { useFullscreen } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScreenLock } from '../../../composables'
import { useSettingsStore } from '../../../stores'

const { t } = useI18n()
const { orientation, toggle } = useScreenLock()
const { isFullscreen, enter, exit } = useFullscreen()
const settings = useSettingsStore()
const items = computed<AdvMenuItemProps[]>(() => [
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
])
</script>

<template>
  <MenuItem v-for="item in items" :key="item.label" :item="item" />
  <HorizontalDivider />
  <AdvMotionSettings />
</template>
