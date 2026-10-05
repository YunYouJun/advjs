<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  icon?: string
  size?: 'mini' | '' | 'large'
  theme?: 'default' | 'primary' | 'danger'
  variant?: 'base' | 'outline' | 'text'
  loading?: boolean
  disabled?: boolean
}>(), {
  size: '',
  theme: 'default',
  variant: 'base',
})

const classes = computed(() => {
  const cls: string[] = []
  if (props.size)
    cls.push(props.size)
  if (props.theme !== 'default')
    cls.push(`theme-${props.theme}`)
  if (props.variant !== 'base')
    cls.push(`variant-${props.variant}`)
  if (props.loading)
    cls.push('is-loading')
  if (props.disabled || props.loading)
    cls.push('is-disabled')
  return cls
})
</script>

<template>
  <button
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    type="button"
    class="agui-button"
  >
    <div v-if="loading" aria-hidden="true" class="i-svg-spinners:ring-resize text-xs mr-1 inline-flex" />
    <div v-else-if="icon" aria-hidden="true" class="mr-1 inline-flex" :class="icon" />
    <slot />
  </button>
</template>

<style lang="scss">
.agui-button {
  --button-bg: var(--agui-c-control);
  --button-hover: var(--agui-c-control-hover);
  --button-pressed: var(--agui-c-control-pressed);
  --button-text: var(--agui-c-text-1);
  --button-border: var(--agui-c-control-border);
  --border-radius: 2px;

  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-height: var(--agui-control-height);
  min-width: var(--agui-control-height);
  padding: 2px 6px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  appearance: none;
  background: var(--button-bg);
  color: var(--button-text);
  cursor: pointer;
  border: 1px solid var(--button-border);
  border-radius: var(--border-radius);
  transition:
    background-color 150ms ease,
    border-color 150ms ease;

  &[data-location='LEFT'] {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  &[data-location='RIGHT'] {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  &:hover:not(:disabled) {
    background: var(--button-hover);
  }
  &:active:not(:disabled),
  &.pressed {
    background: var(--button-pressed);
  }
  &:focus-visible {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }
  &.mini {
    font-size: 11px;
  }
  &.large {
    min-height: 28px;
    padding-inline: 8px;
  }

  &.theme-primary {
    --button-bg: var(--agui-c-primary);
    --button-hover: var(--agui-c-primary-hover);
    --button-pressed: var(--agui-c-primary-pressed);
    --button-text: var(--agui-c-on-accent);
    --button-border: var(--agui-c-primary);
  }
  &.theme-danger {
    --button-bg: var(--agui-c-danger);
    --button-hover: var(--agui-c-danger-hover);
    --button-pressed: var(--agui-c-danger-pressed);
    --button-text: var(--agui-c-on-accent);
    --button-border: var(--agui-c-danger);
  }
  &.variant-outline,
  &.variant-text {
    background: transparent;
    color: var(--agui-c-text-1);
    &:hover:not(:disabled) {
      background: var(--agui-c-bg-hover);
    }
    &:active:not(:disabled) {
      background: var(--agui-c-control-pressed);
    }
    &.theme-primary {
      color: var(--agui-c-link);
    }
    &.theme-danger {
      color: var(--agui-c-danger-text);
    }
  }
  &.variant-text {
    border-color: transparent;
  }
  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &.is-loading {
    cursor: wait;
  }
}
@media (prefers-reduced-motion: reduce) {
  .agui-button {
    transition: none;
  }
}
</style>
