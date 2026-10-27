<script lang="ts" setup>
defineProps<{
  icon?: string
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
    <span v-if="icon" class="agui-tag__icon" :class="icon" aria-hidden="true" />
    <span class="agui-tag__label"><slot /></span>
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
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  gap: var(--agui-space-1);
  min-width: 0;
  min-height: var(--agui-tag-min-height);

  padding: 2px var(--agui-space-2);
  font-size: var(--agui-font-size-caption);
  font-weight: 400;
  line-height: var(--agui-tag-line-height);

  border-radius: var(--agui-radius-pill);
  color: var(--agui-c-text-1);

  .agui-tag__label {
    min-width: 0;
    line-height: inherit;
    overflow-wrap: anywhere;
  }

  .agui-tag__icon {
    flex: 0 0 12px;
    width: 12px;
    height: 12px;
  }

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
    flex: 0 0 12px;
    width: 12px;
    height: var(--agui-tag-line-height);

    padding: 0;
    margin: 0;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity var(--agui-motion-duration);

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
