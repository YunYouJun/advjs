<script lang="ts" setup>
defineProps<{
  modelValue?: string
}>()

const emit = defineEmits(['update:modelValue'])

function updateModelValue(event: any) {
  const val = event.target?.value || ''
  emit('update:modelValue', val)
}
</script>

<template>
  <input
    class="agui-input shadow shadow-inset"
    :value="modelValue"
    @input="updateModelValue"
  >
</template>
