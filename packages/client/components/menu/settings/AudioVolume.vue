<script setup lang="ts">
import type { AdvMenuItemProps } from '@advjs/theme-default'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAudioStore } from '../../../stores'

const audio = useAudioStore()

const { t } = useI18n()
const soundVolumeItem = computed(
  () => ({
    label: t('settings.sound_volume'),
    type: 'Checkbox',
    props: {
      checked: !audio.isSoundMuted,
      onClick: () => {
        audio.toggleSoundMuted()
      },
    },
  } as AdvMenuItemProps),
)

const musicVolumeItem = computed(
  () => ({
    label: t('settings.music_volume'),
    type: 'Checkbox',
    props: {
      checked: !audio.isMusicMuted,
      onClick: () => {
        audio.toggleMusicMuted()
        audio.curBgm.pause()
      },
    },
  } as AdvMenuItemProps),
)
</script>

<template>
  <MenuItem :item="soundVolumeItem" />
  <MenuItem :item="musicVolumeItem" />
</template>
