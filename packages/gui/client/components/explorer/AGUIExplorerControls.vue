<script lang="ts" setup>
import { AGUIInput } from '..'
</script>

<template>
  <div class="agui-explorer-controls">
    <div />
    <div class="flex-grow" />
    <slot />
    <AGUIInput class="w-30" />
  </div>
</template>

<style>
.agui-explorer-controls {
  display: flex;
  align-items: center;
  padding: 0 4px;
  height: var(--agui-explorer-controls-height, 32px);

  border-bottom: 1px solid var(--agui-c-border, #222);
}
</style>
