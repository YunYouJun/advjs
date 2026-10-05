<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import '../input/fields.scss'

const props = defineProps<{
  autofocus?: boolean
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  rows?: number
}>()

const emit = defineEmits(['update:modelValue'])

function updateModelValue(event: Event) {
  const val = (event.target as HTMLTextAreaElement)?.value || ''
  emit('update:modelValue', val)
}

const textareaRef = ref<HTMLTextAreaElement | null>()

onMounted(async () => {
  if (props.autofocus) {
    setTimeout(() => {
      textareaRef.value?.focus()
    }, 1)
  }
})
</script>

<template>
  <textarea
    ref="textareaRef"
    class="agui-textarea"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows || 3"
    @input="updateModelValue"
  />
</template>
