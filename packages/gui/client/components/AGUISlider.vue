<script lang="ts" setup>
import AGUIInputNumber from './input/AGUIInputNumber.vue'
import { clampNumber } from './input/numeric'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  modelValue: number
  step?: number
  min?: number
  max?: number
  showInput?: boolean
  disabled?: boolean
  label?: string
}>(), { step: 1, min: 0, max: 360, showInput: false })
const emit = defineEmits<{ 'update:modelValue': [value: number], 'input': [value: number] }>()
function update(value: number) {
  if (props.disabled || !Number.isFinite(value))
    return
  const next = clampNumber(value, props.min, props.max)
  emit('update:modelValue', next)
  emit('input', next)
}
</script>

<template>
  <div class="agui-slider-container" :class="$attrs.class" :style="$attrs.style">
    <input
      v-bind="{ ...$attrs, class: undefined, style: undefined }"
      class="agui-slider" type="range"
      :aria-label="label || ($attrs['aria-label'] as string | undefined)"
      :value="modelValue" :min="min" :max="max" :step="step" :disabled="disabled"
      @input="update(($event.target as HTMLInputElement).valueAsNumber)"
    >
    <AGUIInputNumber v-if="showInput" class="agui-slider-input" :aria-label="label || ($attrs['aria-label'] as string | undefined)" :aria-labelledby="($attrs['aria-labelledby'] as string | undefined)" :model-value="modelValue" :min="min" :max="max" :step="step" :disabled="disabled" @update:model-value="update" />
  </div>
</template>

<style lang="scss">
@use '../styles/slider.scss';
</style>
