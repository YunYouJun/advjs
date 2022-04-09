<template>
  <div class="flex justify-center items-center">
    <span class="mr-2">{{ label }}</span>
    <div class="inline-flex adv-slider-container">
      <!-- eslint-disable-next-line vue/no-mutating-props -->
      <input :value="modelValue" class="adv-slider w-40" type="range" :min="min || 0" :max="max || 360" :step="step" text="black" @input="input">
    </div>
    <input :value="modelValue" class="adv-slider-input" :step="step" @input="input">{{ unit }}
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  label: string
  modelValue: number
  /**
   * 单位
   */
  unit?: string
  step?: number
  min?: number
  max?: number
}>()

const emit = defineEmits(['update:modelValue', 'input'])

const input = (event: any) => {
  const val = event.target?.valueAsNumber || 0
  emit('update:modelValue', val)
  emit('input', val)
}
</script>
