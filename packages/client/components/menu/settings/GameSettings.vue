<script lang="ts" setup>
import type { AdvMenuItemProps } from '@advjs/theme-default'

// import { useSettingsStore } from '@advjs/client'

// const settings = useSettingsStore()

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const item = computed<AdvMenuItemProps<'Slider'>>(() => ({
  label: t('settings.animation_duration'),
  type: 'Slider',
  props: {
    // label: 'duration',
    label: '',
    modelValue: ref(0),
    unit: 's',
    min: 0,
    max: 1,
    step: 0.1,
  },
}))
</script>

<template>
  <MenuItem :item="item" />
</template>
