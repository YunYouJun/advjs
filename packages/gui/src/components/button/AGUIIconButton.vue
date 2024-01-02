<script lang="ts" setup>
defineProps<{
  active?: boolean
  icon?: string
}>()
</script>

<template>
  <button
    class="agui-button inline-flex rounded bg-$agui-c-bg-1 px-2 py-1 text-xs hover:bg-$agui-c-bg-2"
    items-center justify-center
    :class="active ? 'active' : ''"
  >
    <slot>
      <div :class="icon" />
    </slot>
  </button>
</template>

<style>
.agui-button {
  &.active {
    background-color: var(--agui-c-active);
  }
}
</style>
