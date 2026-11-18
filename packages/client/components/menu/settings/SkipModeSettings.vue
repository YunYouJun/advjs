<script setup lang="ts">
import { computed } from 'vue'
import { useGameControlsI18n } from '../../../composables/useGameControlsI18n'
import { useSkipPreference } from '../../../composables/useSkipPreference'
import SettingsRadioGroup from './SettingsRadioGroup.vue'

const mode = useSkipPreference()
const { t } = useGameControlsI18n()
const options = computed(() => (['read', 'all'] as const).map(value => ({ value, label: t(`skipSettings.${value}`) })))
</script>

<template>
  <SettingsRadioGroup
    v-model="mode" class="skip-mode-settings" name="skip-mode" :legend="t('skipSettings.title')"
    :options="options" :description="t(`skipSettings.${mode}Description`)"
  />
</template>
