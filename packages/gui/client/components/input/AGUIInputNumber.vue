<script lang="ts" setup>
import { clampNumber } from './numeric'

const props = defineProps<{
  modelValue?: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
function updateModelValue(event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (!props.disabled && Number.isFinite(value))
    emit('update:modelValue', clampNumber(value, props.min, props.max))
}
function restoreValue(event: FocusEvent) {
  (event.target as HTMLInputElement).value = props.modelValue === undefined ? '' : String(props.modelValue)
}
</script>

<template>
  <input class="agui-input" type="number" :value="modelValue" :min="min" :max="max" :step="step" :disabled="disabled" @input="updateModelValue" @blur="restoreValue">
</template>

<style lang="scss">
@use './fields.scss';
</style>
