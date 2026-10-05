<script setup lang="ts">
import { useDialogBarPreference } from '../../../composables/useDialogBarPreference'
import { useGameControlsI18n } from '../../../composables/useGameControlsI18n'

const mode = useDialogBarPreference()
const { t } = useGameControlsI18n()
const modes = ['always', 'auto', 'collapsed'] as const
</script>

<template>
  <fieldset class="dialog-bar-settings">
    <legend>{{ t('barSettings.title') }}</legend>
    <label v-for="value in modes" :key="value" class="dialog-bar-option" :class="{ selected: mode === value }">
      <input v-model="mode" type="radio" name="dialog-bar-mode" :value="value">
      <span>{{ t(`barSettings.${value}`) }}</span>
    </label>
    <p>{{ t(`barSettings.${mode}Description`) }}</p>
  </fieldset>
</template>

<style scoped>
.dialog-bar-settings {
  grid-column: 1 / -1;
  margin: 0;
  padding: 0;
  border: 0;
}

.dialog-bar-settings legend {
  margin-bottom: 8px;
  font-size: 18px;
  font-weight: 700;
}

.dialog-bar-option {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  margin: 0 8px 8px 0;
  padding: 6px 10px;
  border: 1px solid rgb(148 163 184 / 40%);
  border-radius: 6px;
  cursor: pointer;
}

.dialog-bar-option.selected {
  border-color: #b59156;
  background: rgb(185 145 86 / 12%);
}

.dialog-bar-option:focus-within {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.dialog-bar-settings p {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.8;
}
</style>
