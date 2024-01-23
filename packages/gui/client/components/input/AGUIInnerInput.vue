<script lang="ts" setup>
defineProps<{
  className?: string
  prefixIcon?: string
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue'])

function updateModelValue(event: any) {
  const val = event.target?.value || ''
  emit('update:modelValue', val)
}
</script>

<template>
  <input
    class="agui-input w-full px-1 shadow shadow-inset"
    :value="modelValue"
    :placeholder="placeholder"
    @input="updateModelValue"
  >
</template>
