<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  options: Array<{ value: string, label: string }>
  size?: 'sm' | 'md' | 'lg'
}>(), {
  modelValue: undefined,
  placeholder: '',
  disabled: false,
  size: 'md',
})

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="(v: string) => $emit('update:modelValue', v)"
  >
    <SelectTrigger
      class="s-select-trigger"
      :class="[`s-select-trigger--${size}`]"
    >
      <SelectValue :placeholder="placeholder" />
      <span class="s-select-trigger__icon">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </span>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        class="s-select-content"
        position="popper"
        :side-offset="4"
      >
        <SelectViewport class="s-select-viewport">
          <SelectItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
            class="s-select-item"
          >
            <SelectItemText>{{ opt.label }}</SelectItemText>
            <SelectItemIndicator class="s-select-item__check">
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5.5L4 8.5L11 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<!-- Trigger styles — scoped is fine, they stay in this component -->
<style scoped>
.s-select-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-xs);
  border: 1.5px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-card);
  color: var(--adv-text-primary);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  font-family: inherit;
  transition:
    border-color var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default);
}

.s-select-trigger:focus-visible {
  outline: none;
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.12);
}

.s-select-trigger[data-disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}

.s-select-trigger[data-placeholder] {
  color: var(--adv-text-tertiary);
}

.s-select-trigger--sm {
  height: 32px;
  padding: 0 var(--adv-space-sm);
  font-size: var(--adv-font-body-sm);
}

.s-select-trigger--md {
  height: 40px;
  padding: 0 10px;
  font-size: var(--adv-font-body);
}

.s-select-trigger--lg {
  height: 48px;
  padding: 0 var(--adv-space-md);
  font-size: var(--adv-font-subtitle);
}

.s-select-trigger__icon {
  display: flex;
  align-items: center;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
  transition: transform var(--adv-duration-fast) var(--adv-ease-default);
}

.s-select-trigger[data-state='open'] .s-select-trigger__icon {
  transform: rotate(180deg);
}
</style>

<!-- Dropdown styles — MUST be unscoped because SelectPortal teleports content outside this component -->
<style>
.s-select-content {
  width: var(--reka-select-trigger-width);
  max-height: var(--reka-select-content-available-height, 280px);
  background: var(--adv-surface-card, #fff);
  border: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
  border-radius: var(--adv-radius-sm, 8px);
  box-shadow:
    0 8px 30px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 9999;
  overflow: hidden;
  animation: s-select-in 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

:root.dark .s-select-content {
  background: var(--adv-surface-card, #1e1e2e);
  border-color: var(--adv-border-subtle, rgba(255, 255, 255, 0.08));
  box-shadow:
    0 8px 30px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

@keyframes s-select-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.s-select-viewport {
  padding: 4px;
}

.s-select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--adv-radius-xs);
  font-size: var(--adv-font-body, 15px);
  color: var(--adv-text-primary, #111827);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition: background 100ms ease;
}

.s-select-item[data-highlighted] {
  background: rgba(var(--ion-color-primary-rgb, 99, 102, 241), 0.08);
  color: var(--ion-color-primary, #7c3aed);
}

.s-select-item[data-state='checked'] {
  font-weight: 600;
}

.s-select-item[data-disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

.s-select-item__check {
  display: flex;
  align-items: center;
  color: var(--ion-color-primary, #7c3aed);
}
</style>
