<script setup lang="ts">
import type { NumericProps } from './input/numeric'
import AGUINumericControl from './input/AGUINumericControl.vue'

defineProps<NumericProps>()
const emit = defineEmits<{
  'change': [value: number]
  'update:modelValue': [value: number]
}>()
</script>

<template>
  <AGUINumericControl
    v-bind="$props"
    class="agui-number-field"
    @change="emit('change', $event)"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
