<script lang="ts" setup>
defineProps<{
  value?: string | number | boolean
  checked?: boolean
  disabled?: boolean
}>()

const emit = defineEmits([
  'update:checked',
])

function onChange(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:checked', target.checked)
}
</script>

<template>
  <input
    class="agui-checkbox" type="checkbox"
    :value="value" :checked="checked" :disabled="disabled"
    @change="onChange"
  >
</template>
