<script lang="ts" setup>
defineProps<{
  icon?: string
  title: string
}>()
</script>

<template>
  <details class="agui-details">
    <slot name="summary">
      <summary class="agui-summary">
        <span v-if="icon" class="agui-summary-icon" :class="icon" aria-hidden="true" />
        <span class="title">{{ title }}</span>
      </summary>
    </slot>
    <div class="content">
      <slot />
    </div>
  </details>
</template>

<style lang="scss">
.agui-details {
  width: 100%;
  min-width: 0;
  border-top: 1px solid var(--agui-c-divider);
  color: var(--agui-c-text-1);
  font-size: 12px;
  line-height: 1.5;
  container: agui-properties / inline-size;

  &:first-child {
    border-top: none;
  }

  > .agui-summary {
    box-sizing: border-box;
    min-height: 28px;
    margin: 0;
    padding: 5px 8px;
    cursor: pointer;
    user-select: none;
    overflow-wrap: anywhere;
    background-color: var(--agui-c-bg-summary);

    &:hover {
      background-color: var(--agui-c-bg-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--agui-c-focus);
      outline-offset: -2px;
    }

    .agui-summary-icon {
      display: inline-block;
      margin-right: 4px;
      vertical-align: middle;
    }
  }

  > .content {
    min-width: 0;
    padding: 8px 12px;
  }
}
</style>
