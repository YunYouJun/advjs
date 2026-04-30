<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'primary',
  size: 'md',
  block: false,
  disabled: false,
  loading: false,
  type: 'button',
})

const classes = computed(() => [
  's-button',
  `s-button--${props.variant}`,
  `s-button--${props.size}`,
  props.block && 's-button--block',
  (props.disabled || props.loading) && 's-button--disabled',
])
</script>

<template>
  <button
    :class="classes"
    :type="type"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="s-button__spinner" />
    <slot />
  </button>
</template>

<style scoped>
.s-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--adv-space-xs);
  border: none;
  border-radius: var(--adv-radius-sm);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  transition:
    background var(--adv-duration-fast) var(--adv-ease-default),
    color var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default),
    transform var(--adv-duration-fast) var(--adv-ease-default),
    opacity var(--adv-duration-fast) var(--adv-ease-default);
}

.s-button:active:not(:disabled) {
  transform: scale(0.97);
}

/* ── Sizes ── */
.s-button--sm {
  height: 32px;
  padding: 0 var(--adv-space-sm);
  font-size: var(--adv-font-body-sm);
}

.s-button--md {
  height: 40px;
  padding: 0 var(--adv-space-md);
  font-size: var(--adv-font-body);
}

.s-button--lg {
  height: 48px;
  padding: 0 var(--adv-space-lg);
  font-size: var(--adv-font-subtitle);
}

/* ── Variants ── */
.s-button--primary {
  background: var(--adv-gradient-primary, var(--ion-color-primary));
  color: var(--ion-color-primary-contrast);
  box-shadow:
    var(--adv-shadow-subtle),
    0 2px 12px rgba(var(--ion-color-primary-rgb), 0.2);
}

.s-button--primary:hover:not(:disabled) {
  box-shadow:
    var(--adv-shadow-medium),
    0 4px 20px rgba(var(--ion-color-primary-rgb), 0.3);
  filter: brightness(1.05);
}

.s-button--secondary {
  background: var(--adv-primary-light);
  color: var(--adv-primary);
  border: 1px solid rgba(var(--adv-primary-rgb), 0.15);
}

.s-button--secondary:hover:not(:disabled) {
  background: rgba(var(--adv-primary-rgb), 0.12);
  box-shadow: 0 2px 8px rgba(var(--adv-primary-rgb), 0.1);
}

.s-button--outline {
  background: transparent;
  color: var(--ion-color-primary);
  border: 1.5px solid var(--ion-color-primary);
}

.s-button--outline:hover:not(:disabled) {
  background: rgba(var(--ion-color-primary-rgb), 0.06);
}

.s-button--ghost {
  background: transparent;
  color: var(--adv-text-secondary);
}

.s-button--ghost:hover:not(:disabled) {
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
}

.s-button--danger {
  background: var(--ion-color-danger, #ef4444);
  color: #fff;
}

.s-button--danger:hover:not(:disabled) {
  opacity: 0.9;
}

.s-button--icon {
  background: transparent;
  color: var(--adv-text-secondary);
  border-radius: var(--adv-radius-md);
  padding: 0;
}

.s-button--icon.s-button--sm {
  width: 32px;
  height: 32px;
}

.s-button--icon.s-button--md {
  width: 40px;
  height: 40px;
}

.s-button--icon.s-button--lg {
  width: 48px;
  height: 48px;
}

.s-button--icon:hover:not(:disabled) {
  background: var(--adv-surface-hover);
  color: var(--adv-primary);
}

/* ── Block ── */
.s-button--block {
  display: flex;
  width: 100%;
}

/* ── Disabled ── */
.s-button--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Loading spinner ── */
.s-button__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: s-spin 0.6s linear infinite;
}

@keyframes s-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
