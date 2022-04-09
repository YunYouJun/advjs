<template>
  <MenuItem :item="item" />
</template>

<script lang="ts" setup>
import type { AdvMenuItemProps } from '@advjs/theme-default'
// import { useSettingsStore } from '~/stores/settings'

// const settings = useSettingsStore()

const { t } = useI18n()

const item = computed<AdvMenuItemProps<'Slider'>>(() => ({
  label: t('settings.animation_duration'),
  type: 'Slider',
  props: {
    label: 'duration',
    modelValue: ref(0),
    unit: 's',
    min: 0,
    max: 1,
    step: 0.1,
  },
}))
</script>
