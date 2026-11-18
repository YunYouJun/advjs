<script setup lang="ts" generic="T extends string">
defineProps<{
  legend: string
  name: string
  options: ReadonlyArray<{ value: T, label: string }>
  description?: string
}>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <fieldset class="settings-radio-group">
    <legend>{{ legend }}</legend>
    <label v-for="option in options" :key="option.value" class="settings-radio-option" :class="{ selected: model === option.value }">
      <input v-model="model" type="radio" :name="name" :value="option.value">
      <span>{{ option.label }}</span>
    </label>
    <p v-if="description">
      {{ description }}
    </p>
  </fieldset>
</template>

<style scoped>
.settings-radio-group {
  grid-column: 1 / -1;
  margin: 0;
  padding: 0;
  border: 0;
}

.settings-radio-group legend {
  margin-bottom: 0.5em;
  font-size: inherit;
  font-weight: 700;
}

.settings-radio-option {
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

.settings-radio-option input {
  margin: 0;
  accent-color: var(--adv-c-primary);
}

.settings-radio-option.selected {
  border-color: var(--adv-c-primary, #b59156);
  background: color-mix(in srgb, var(--adv-c-primary, #b59156) 12%, transparent);
}

.settings-radio-option:focus-within {
  outline: 2px solid var(--adv-c-focus, var(--adv-c-primary));
  outline-offset: 2px;
}

.settings-radio-group p {
  margin: 0 0 0.5em;
  font-size: 0.875em;
  line-height: 1.6;
  opacity: 0.8;
}
</style>
