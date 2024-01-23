<script lang="ts" setup>
defineProps<{
  modelValue?: number

  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function updateModelValue(event: Event) {
  const val = (event.target as HTMLInputElement)?.valueAsNumber || 0
  emit('update:modelValue', val)
}
</script>

<template>
  <input
    v-number-drag
    class="agui-input pl-1 pr-0"
    type="number"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    @input="updateModelValue"
  >
</template>
