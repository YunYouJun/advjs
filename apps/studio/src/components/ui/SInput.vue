<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  inputmode?: 'text' | 'numeric' | 'tel' | 'email' | 'url' | 'search' | 'decimal' | 'none'
  maxlength?: number
  clearable?: boolean
  size?: 'sm' | 'md' | 'lg'
}>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  disabled: false,
  inputmode: undefined,
  maxlength: undefined,
  clearable: false,
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const showClear = computed(() => {
  return props.clearable && !props.disabled && String(props.modelValue).length > 0
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function clear() {
  emit('update:modelValue', '')
  inputRef.value?.focus()
}

defineExpose({ inputRef })
</script>

<template>
  <div
    class="s-input"
    :class="[
      `s-input--${size}`,
      disabled && 's-input--disabled',
    ]"
  >
    <slot name="prefix" />
    <input
      ref="inputRef"
      class="s-input__native"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :inputmode="inputmode"
      :maxlength="maxlength"
      @input="onInput"
    >
    <button
      v-if="showClear"
      type="button"
      class="s-input__clear"
      tabindex="-1"
      @click="clear"
    >
      ×
    </button>
    <slot name="suffix" />
  </div>
</template>

<style scoped>
.s-input {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
  border: 1.5px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-card);
  transition:
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default);
}

.s-input:focus-within {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.12);
}

/* ── Sizes ── */
.s-input--sm {
  height: 32px;
  padding: 0 var(--adv-space-sm);
  font-size: var(--adv-font-body-sm);
}

.s-input--md {
  height: 40px;
  padding: 0 var(--adv-space-sm);
  font-size: var(--adv-font-body);
}

.s-input--lg {
  height: 48px;
  padding: 0 var(--adv-space-md);
  font-size: var(--adv-font-subtitle);
}

/* ── Native input ── */
.s-input__native {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--adv-text-primary);
  font: inherit;
}

.s-input__native::placeholder {
  color: var(--adv-text-tertiary);
}

/* ── Clear button ── */
.s-input__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: var(--adv-surface-elevated);
  color: var(--adv-text-tertiary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}

.s-input__clear:hover {
  background: var(--adv-border-subtle);
  color: var(--adv-text-secondary);
}

/* ── Disabled ── */
.s-input--disabled {
  opacity: 0.45;
  pointer-events: none;
}
</style>
