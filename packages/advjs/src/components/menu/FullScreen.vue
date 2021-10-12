<template>
  <div class="col-span-4 text-right adv-menu-item">
    <label for="speechSynthesisSwitch">{{ t('settings.fullscreen') }}</label>
  </div>
  <div class="col-span-8 text-left flex items-center">
    <AdvCheckbox :checked="settings.isFullscreen" @click="settings.toggleFullScreen" />
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '~/stores/settings'
const { t } = useI18n()
const settings = useSettingsStore()
</script>
