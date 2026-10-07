<script setup lang="ts">
import type { MotionPreference } from '@advjs/client'
import { useAdvSettingsControls } from '@advjs/client'
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const labelId = useId()
const controls = useAdvSettingsControls()
const options: MotionPreference[] = ['full', 'reduced', 'none']
</script>

<template>
  <div class="adv-menu-item--label">
    <span :id="labelId">{{ t('settings.motion') }}</span>
  </div>
  <div class="adv-menu-item--container adv-motion-settings" role="group" :aria-labelledby="labelId">
    <AdvTextButton
      v-for="option in options"
      :key="option"
      type="button"
      :active="controls.motion.value === option"
      :aria-pressed="controls.motion.value === option"
      @click="controls.motion.value = option"
    >
      {{ t(`settings.motion_${option}`) }}
    </AdvTextButton>
  </div>
</template>

<style scoped>
.adv-motion-settings {
  display: flex;
  align-items: center;
  gap: 0.25em;
  flex-wrap: wrap;
}
</style>
