<script lang="ts" setup>
defineProps<{
  active?: boolean
  icon?: string
}>()
</script>

<template>
  <button
    class="agui-button inline-flex py-1 px-2 bg-$agui-c-bg-1 text-xs rounded hover:bg-$agui-c-bg-2"
    justify-center items-center
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
