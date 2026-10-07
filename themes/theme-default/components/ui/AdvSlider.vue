<script lang="ts" setup>
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed, useId } from 'vue'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  id?: string
  label?: string
  showLabel?: boolean
  modelValue: number
  unit?: string
  step?: number
  min?: number
  max?: number
  disabled?: boolean
}>(), { min: 0, max: 360, step: 1, showLabel: true })
const emit = defineEmits<{
  'update:modelValue': [value: number]
  'input': [value: number]
}>()
const uid = useId()
const controlId = computed(() => props.id || `adv-slider-${uid}`)

function update(value: number | undefined) {
  if (props.disabled || value === undefined || !Number.isFinite(value))
    return
  const clamped = Math.min(props.max, Math.max(props.min, value))
  emit('update:modelValue', clamped)
  emit('input', clamped)
}

function slide(values: number[] | undefined) {
  update(values?.[0])
}

function input(event: Event) {
  update((event.target as HTMLInputElement).valueAsNumber)
}

function restoreValue(event: FocusEvent) {
  (event.target as HTMLInputElement).value = String(props.modelValue)
}
</script>

<template>
  <div class="adv-slider-control" :class="$attrs.class" :style="$attrs.style">
    <label v-if="showLabel && label" :for="controlId">{{ label }}</label>
    <SliderRoot
      v-bind="{ ...$attrs, 'class': undefined, 'style': undefined, 'id': undefined, 'aria-label': undefined, 'aria-labelledby': undefined, 'aria-describedby': undefined }"
      class="adv-slider" thumb-alignment="overflow" :model-value="[modelValue]" :min="min" :max="max" :step="step" :disabled="disabled"
      @update:model-value="slide"
    >
      <SliderTrack class="adv-slider-track">
        <SliderRange class="adv-slider-range" />
      </SliderTrack>
      <SliderThumb
        :id="controlId" class="adv-slider-thumb" as-child
        :aria-label="label || ($attrs['aria-label'] as string | undefined)"
        :aria-labelledby="($attrs['aria-labelledby'] as string | undefined)"
        :aria-describedby="($attrs['aria-describedby'] as string | undefined)"
        :aria-disabled="disabled || undefined"
      >
        <button type="button" :disabled="disabled" />
      </SliderThumb>
    </SliderRoot>
    <input
      :value="modelValue" class="adv-slider-input" type="number"
      :aria-label="label || ($attrs['aria-label'] as string | undefined)"
      :aria-labelledby="($attrs['aria-labelledby'] as string | undefined)"
      :aria-describedby="($attrs['aria-describedby'] as string | undefined)"
      :min="min" :max="max" :step="step" :disabled="disabled" @input="input" @blur="restoreValue"
    >
    <span v-if="unit">{{ unit }}</span>
  </div>
</template>
