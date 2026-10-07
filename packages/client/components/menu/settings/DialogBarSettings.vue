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
  margin-bottom: 0.5em;
  font-size: inherit;
  font-weight: 700;
}

.dialog-bar-option {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 0.375em;
  min-height: 2.75em;
  margin: 0 0.5em 0.5em 0;
  padding: 0.375em 0.625em;
  border: 1px solid color-mix(in srgb, var(--adv-c-text) 25%, transparent);
  border-radius: calc(var(--adv-control-radius, 4px) / var(--adv-screen-scale, 1));
  cursor: pointer;
}

.dialog-bar-option input {
  margin: 0;
  accent-color: var(--adv-c-primary);
}

.dialog-bar-option.selected {
  border-color: var(--adv-c-primary, #b59156);
  background: color-mix(in srgb, var(--adv-c-primary, #b59156) 12%, transparent);
}

.dialog-bar-option:focus-within {
  outline: 2px solid var(--adv-c-focus, var(--adv-c-primary));
  outline-offset: 2px;
}

.dialog-bar-settings p {
  margin: 0 0 0.5em;
  font-size: 0.875em;
  line-height: 1.6;
  opacity: 0.8;
}
</style>
