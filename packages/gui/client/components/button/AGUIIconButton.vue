<script lang="ts" setup>
withDefaults(defineProps<{
  active?: boolean
  icon?: string
  title?: string
  disabled?: boolean
  size?: 'mini' | '' | 'large'
}>(), { active: undefined })
</script>

<template>
  <button
    type="button"
    class="agui-icon-button"
    :class="[{ active }, size]"
    :aria-pressed="active"
    :aria-label="title"
    :title="title"
    :disabled="disabled"
  >
    <slot>
      <span class="agui-icon-button-icon" :class="icon" aria-hidden="true" />
    </slot>
  </button>
</template>

<style lang="scss">
.agui-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex-shrink: 0;
  min-width: var(--agui-control-height);
  min-height: var(--agui-control-height);
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--agui-c-text-1);
  background: transparent;
  appearance: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 100ms ease;

  .agui-icon-button-icon {
    flex-shrink: 0;
    width: 1em;
    height: 1em;
  }

  &:hover:not(:disabled) {
    background: var(--agui-c-icon-hover);
  }

  &:active:not(:disabled) {
    background: var(--agui-c-icon-pressed);
  }

  &.active {
    color: var(--agui-c-on-accent);
    background: var(--agui-c-primary);
  }

  &.active:hover:not(:disabled) {
    background: var(--agui-c-primary-hover);
  }

  &.active:active:not(:disabled) {
    background: var(--agui-c-primary-pressed);
  }

  &.large {
    min-width: 28px;
    min-height: 28px;
    font-size: 16px;
  }

  &:focus-visible {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

@media (prefers-reduced-motion: reduce) {
  .agui-icon-button {
    transition: none;
  }
}
</style>
