<script setup lang="ts">
import type { MotionPreference } from '@advjs/client'
import { useAdvSettingsControls } from '@advjs/client'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const controls = useAdvSettingsControls()
const options: MotionPreference[] = ['full', 'reduced', 'none']
</script>

<template>
  <div col="span-5" class="adv-menu-item--label justify-center" text="3xl">
    <label font="bold serif">{{ t('settings.motion') }}</label>
  </div>
  <div col="span-7" class="adv-motion-settings">
    <button
      v-for="option in options"
      :key="option"
      type="button"
      :class="{ active: controls.motion.value === option }"
      @click="controls.motion.value = option"
    >
      {{ t(`settings.motion_${option}`) }}
    </button>
  </div>
</template>

<style scoped>
.adv-motion-settings {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.adv-motion-settings button {
  border: 1px solid rgb(148 163 184 / 35%);
  border-radius: 0.35rem;
  background: rgb(15 23 42 / 65%);
  padding: 0.55rem 0.8rem;
  color: inherit;
}

.adv-motion-settings button.active {
  border-color: #38bdf8;
  background: rgb(14 116 144 / 55%);
}
</style>
