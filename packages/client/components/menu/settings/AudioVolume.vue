<script setup lang="ts">
import type { AdvMenuItemProps } from '@advjs/theme-default'
import { computed } from 'vue'

import { useI18n } from 'vue-i18n'
import { useAdvCtx } from '~/setup'

const $adv = useAdvCtx()

const { t } = useI18n()
const soundVolumeItem = computed(
  () => ({
    label: t('settings.sound_volume'),
    type: 'Checkbox',
    props: {
      checked: !$adv.audio.isSoundMuted.value,
      onClick: () => {
        $adv.audio.toggleSoundMuted()
      },
    },
  } as AdvMenuItemProps),
)

const musicVolumeItem = computed(
  () => ({
    label: t('settings.music_volume'),
    type: 'Checkbox',
    props: {
      checked: !$adv.audio.isMusicMuted.value,
      onClick: () => {
        $adv.audio.toggleMusicMuted()
      },
    },
  } as AdvMenuItemProps),
)
</script>

<template>
  <MenuItem :item="soundVolumeItem" />
  <MenuItem :item="musicVolumeItem" />
</template>
