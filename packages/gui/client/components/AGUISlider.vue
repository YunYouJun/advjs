<script lang="ts" setup>
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
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

function slide(values: number[] | undefined) {
  const value = values?.[0]
  if (value !== undefined)
    update(value)
}
</script>

<template>
  <div class="agui-slider-container" :class="$attrs.class" :style="$attrs.style">
    <SliderRoot
      v-bind="{ ...$attrs, 'class': undefined, 'style': undefined, 'id': undefined, 'aria-label': undefined, 'aria-labelledby': undefined, 'aria-describedby': undefined }"
      class="agui-slider" thumb-alignment="overflow" :model-value="[modelValue]" :min="min" :max="max" :step="step" :disabled="disabled"
      @update:model-value="slide"
    >
      <SliderTrack class="agui-slider-track">
        <SliderRange class="agui-slider-range" />
      </SliderTrack>
      <SliderThumb
        :id="($attrs.id as string | undefined)" class="agui-slider-thumb" as-child
        :aria-label="label || ($attrs['aria-label'] as string | undefined)"
        :aria-labelledby="($attrs['aria-labelledby'] as string | undefined)"
        :aria-describedby="($attrs['aria-describedby'] as string | undefined)"
        :aria-disabled="disabled || undefined"
      >
        <button type="button" :disabled="disabled" />
      </SliderThumb>
    </SliderRoot>
    <AGUIInputNumber v-if="showInput" class="agui-slider-input" :aria-label="label || ($attrs['aria-label'] as string | undefined)" :aria-labelledby="($attrs['aria-labelledby'] as string | undefined)" :aria-describedby="($attrs['aria-describedby'] as string | undefined)" :model-value="modelValue" :min="min" :max="max" :step="step" :disabled="disabled" @update:model-value="update" />
  </div>
</template>

<style lang="scss">
@use '../styles/slider.scss';
</style>
