<script lang="ts" setup>
import './fields.scss'

defineProps<{
  className?: string
  prefixIcon?: string
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue'])

function updateModelValue(event: Event) {
  const val = (event.target as HTMLInputElement).value
  emit('update:modelValue', val)
}
</script>

<template>
  <input
    class="agui-input"
    :value="modelValue"
    :placeholder="placeholder"
    @input="updateModelValue"
  >
</template>
