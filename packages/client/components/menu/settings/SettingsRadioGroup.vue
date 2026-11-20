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
    <div class="settings-radio-options">
      <label v-for="option in options" :key="option.value" class="settings-radio-option" :class="{ selected: model === option.value }">
        <input v-model="model" type="radio" :name="name" :value="option.value">
        <span>{{ option.label }}</span>
      </label>
    </div>
    <p v-if="description">
      {{ description }}
    </p>
  </fieldset>
</template>

<style lang="scss" scoped>
@use '../../../styles/control-button.scss' as control;

.settings-radio-group {
  grid-column: 1 / -1;
  margin: 0;
  padding: 0;
  border: 0;
}

.settings-radio-group legend {
  margin-bottom: 0.25em;
  font-size: inherit;
  font-weight: 600;
}

.settings-radio-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em;
}

.settings-radio-option {
  @include control.feedback;

  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  min-height: var(--adv-settings-control-height, 2.25em);
  padding: 0.35em 0.625em;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.settings-radio-option input {
  position: absolute;
  inset: calc(-1px / var(--adv-screen-scale, 1));
  width: calc(100% + 2px / var(--adv-screen-scale, 1));
  height: calc(100% + 2px / var(--adv-screen-scale, 1));
  margin: 0;
  opacity: 0;
  cursor: inherit;
}

.settings-radio-option.selected {
  @include control.selection($marker: false);

  > span {
    @include control.text-underline;
  }
}

.settings-radio-option:has(:focus-visible) {
  outline: 2px solid var(--adv-c-focus, var(--adv-c-primary));
  outline-offset: 2px;
}

.settings-radio-group p {
  margin: 0.25em 0 0.5em;
  font-size: 0.875em;
  line-height: 1.6;
  opacity: 0.8;
}
</style>
