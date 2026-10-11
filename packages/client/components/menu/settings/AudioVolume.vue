<script setup lang="ts">
import type { AdvMenuItemProps } from '@advjs/client'
import type { AudioBus } from '@advjs/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAdvContext } from '../../../composables'
import { useAudioStore } from '../../../stores'

const { $adv } = useAdvContext()
const audio = useAudioStore()
const { t } = useI18n()
const buses: AudioBus[] = ['master', 'music', 'ambience', 'voice', 'sfx', 'ui']
function setting(bus: AudioBus) {
  const preference = audio.settings.buses?.[bus]
  const defaults = $adv.gameConfig.value.audio?.mixer?.buses?.[bus]
  return { gain: preference?.gain ?? defaults?.gain ?? 1, muted: preference?.muted ?? defaults?.muted ?? false }
}
const rows = buses.map(bus => ({
  bus,
  enabled: computed<AdvMenuItemProps>(() => ({
    label: t(`settings.audio_${bus}`),
    type: 'Checkbox',
    props: { checked: !setting(bus).muted, onClick: () => audio.setBus(bus, { muted: !setting(bus).muted }) },
  })),
  volume: computed<AdvMenuItemProps<'Slider'>>(() => ({
    label: t('settings.audio_level', { bus: t(`settings.audio_${bus}`) }),
    type: 'Slider',
    props: {
      label: '',
      modelValue: computed({ get: () => setting(bus).gain, set: value => audio.setBus(bus, { gain: value }) }),
      min: 0,
      max: 1,
      step: 0.05,
    },
  })),
}))
</script>

<template>
  <template v-for="row in rows" :key="row.bus">
    <MenuItem :item="row.enabled.value" />
    <MenuItem :item="row.volume.value" />
  </template>
</template>
