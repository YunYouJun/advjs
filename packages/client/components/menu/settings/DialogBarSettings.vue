<script setup lang="ts">
import { computed } from 'vue'
import { useDialogBarPreference } from '../../../composables/useDialogBarPreference'
import { useGameControlsI18n } from '../../../composables/useGameControlsI18n'
import SettingsRadioGroup from './SettingsRadioGroup.vue'

const mode = useDialogBarPreference()
const { t } = useGameControlsI18n()
const options = computed(() => (['always', 'auto', 'collapsed'] as const).map(value => ({ value, label: t(`barSettings.${value}`) })))
</script>

<template>
  <SettingsRadioGroup
    v-model="mode" class="dialog-bar-settings" name="dialog-bar-mode" :legend="t('barSettings.title')"
    :options="options" :description="t(`barSettings.${mode}Description`)"
  />
</template>
