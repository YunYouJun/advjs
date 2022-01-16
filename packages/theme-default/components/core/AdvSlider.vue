<template>
  <div class="flex justify-center items-center">
    <span class="mr-2">{{ label }}</span>
    <div class="inline-flex adv-slider-container">
      <input :value="modelValue" class="adv-slider w-40" type="range" min="0" :max="360" step="0.01" text="black" @input="input">
    </div>
    <input :value="modelValue" class="adv-slider-input" step="0.1" @input="input">°
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  label: string
  modelValue: number
}>()

const emit = defineEmits(['update:modelValue', 'input'])

const input = (event: any) => {
  const val = event.target?.valueAsNumber || 0
  emit('update:modelValue', val)
  emit('input', val)
}
</script>
