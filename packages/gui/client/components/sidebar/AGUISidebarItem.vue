<script setup lang="ts">
import type { AGUISidebarMenuItem } from './types'

defineProps<{
  active?: boolean
  item: AGUISidebarMenuItem
}>()
</script>

<template>
  <button
    class="agui-sidebar-item h-12 w-full flex items-center justify-center text-lg text-$agui-c-text-2 op-60 hover:op-100"
    :class="{ active }"
    :title="item.title"
  >
    <div :class="item.icon" />
  </button>
</template>

<style lang="scss">
.agui-sidebar-item {
  &:focus,
  &:active,
  &.active {
    outline: none;
    opacity: 1;

    position: relative;
    color: var(--agui-c-text);

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 2px;
      height: 100%;
      background-color: var(--agui-c-text);
    }
  }
}
</style>
