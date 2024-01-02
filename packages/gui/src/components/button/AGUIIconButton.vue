<script lang="ts" setup>
defineProps<{
  active?: boolean
  icon?: string
}>()
</script>

<template>
  <button
    class="agui-icon-button inline-flex rounded bg-$agui-c-bg-1 text-xs hover:bg-$agui-c-bg-2"
    items-center justify-center
    :class="active ? 'active' : ''"
  >
    <slot>
      <div :class="icon" />
    </slot>
  </button>
</template>

<style lang="scss">
.agui-icon-button {
  &.active {
    background-color: var(--agui-c-active);
  }

  padding: 6px;
}
</style>
