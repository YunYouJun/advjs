<script setup lang="ts">
import type { NumericProps } from './input/numeric'
import AGUINumericControl from './input/AGUINumericControl.vue'

defineProps<NumericProps & { title?: string }>()
const emit = defineEmits<{
  'change': [value: number]
  'update:modelValue': [value: number]
}>()
</script>

<template>
  <AGUINumericControl
    v-bind="$props"
    class="agui-number-slider"
    slider
    @change="emit('change', $event)"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
