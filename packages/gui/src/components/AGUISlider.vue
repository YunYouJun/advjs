<script lang="ts" setup>
defineProps<{
  modelValue: number
  step?: number
  min?: number
  max?: number
}>()

const emit = defineEmits(['update:modelValue', 'input'])

function input(event: any) {
  const val = event.target?.valueAsNumber || 0
  emit('update:modelValue', val)
  emit('input', val)
}
</script>

<template>
  <div class="agui-slider-container">
    <!-- eslint-disable-next-line vue/no-mutating-props -->
    <input :value="modelValue" class="agui-slider" type="range" :min="min || 0" :max="max || 360" :step="step" text="black" @input="input">
  </div>
</template>
