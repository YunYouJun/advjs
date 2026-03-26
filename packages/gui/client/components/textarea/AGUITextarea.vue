<script lang="ts" setup>
import { onMounted, ref } from 'vue'

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
    class="agui-textarea w-full px-2 py-1 shadow shadow-inset"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows || 3"
    @input="updateModelValue"
  />
</template>

<style lang="scss">
.agui-textarea {
  --agui-textarea-c-bg: rgba(42, 42, 42, 1);

  color: var(--agui-c-label);
  background-color: var(--agui-textarea-c-bg, rgba(42, 42, 42, 1));
  border: 1px solid var(--agui-c-border);

  border-radius: 3px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;

  box-sizing: border-box;
  transition: border-color 0.2s ease-in-out;

  &:focus {
    outline: none;
    border-color: var(--agui-c-active);
  }

  &:disabled {
    opacity: 0.5;
    color: var(--agui-c-text-3);
    border-color: var(--agui-c-border);
    resize: none;
  }
}
</style>
