<script lang="ts" setup>
defineProps<{
  closable?: boolean
  theme?: 'default' | 'primary' | 'danger'
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <span
    class="agui-tag"
    :class="{
      [`agui-tag--${theme || 'default'}`]: true,
      [`agui-tag--tone-${tone}`]: tone !== undefined,
    }"
  >
    <slot />
    <button
      v-if="closable"
      type="button"
      class="agui-tag__close"
      @click.stop="$emit('close')"
    >
      <div class="i-ri-close-line text-xs" />
    </button>
  </span>
</template>

<style lang="scss">
.agui-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;

  padding: 1px 8px;
  font-size: 11px;
  line-height: 1.5;

  border-radius: 10px;
  color: var(--agui-c-text-1);

  &--default {
    background-color: var(--agui-c-control);
  }

  &--primary {
    background-color: var(--agui-c-selection);
    color: var(--agui-c-selection-text);
  }

  &--danger {
    background-color: var(--agui-c-danger-soft);
    color: var(--agui-c-danger-text);
  }

  &--tone-neutral {
    background-color: var(--agui-c-control);
    color: var(--agui-c-text-1);
  }

  &--tone-info {
    background-color: var(--agui-c-selection);
    color: var(--agui-c-selection-text);
  }

  &--tone-success {
    background-color: var(--agui-c-success-soft);
    color: var(--agui-c-success-text);
  }

  &--tone-warning {
    background-color: var(--agui-c-warning-soft);
    color: var(--agui-c-warning-text);
  }

  &--tone-danger {
    background-color: var(--agui-c-danger-soft);
    color: var(--agui-c-danger-text);
  }

  .agui-tag__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;

    padding: 0;
    margin-left: 2px;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.15s;

    &:hover {
      opacity: 1;
    }

    &:focus-visible {
      outline: 2px solid var(--agui-c-focus);
      outline-offset: 1px;
    }
  }
}
</style>
