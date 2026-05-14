<script setup lang="ts">
import type { AdvMenuItemProps } from '@advjs/theme-default'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAdvContext } from '../../../composables'
import { useAudioStore } from '../../../stores'

const { $adv } = useAdvContext()
const audio = useAudioStore()
const { bgmVolume } = storeToRefs(audio)

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
      checked: !$adv.$bgm.isMuted.value,
      onClick: () => {
        $adv.$bgm.toggleMute()
      },
    },
  } as AdvMenuItemProps),
)

const musicVolumeSliderItem = computed<AdvMenuItemProps<'Slider'>>(() => ({
  label: t('settings.music_volume_level'),
  type: 'Slider',
  props: {
    label: '',
    modelValue: bgmVolume,
    min: 0,
    max: 1,
    step: 0.05,
  },
}))
</script>

<template>
  <MenuItem :item="soundVolumeItem" />
  <MenuItem :item="musicVolumeItem" />
  <MenuItem :item="musicVolumeSliderItem" />
</template>
