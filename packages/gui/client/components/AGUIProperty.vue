<script setup lang="ts">
defineProps<{
  label?: string
  hint?: string
  group?: boolean
}>()
</script>

<template>
  <div :class="{ group }" class="agui-property text-xs">
    <div class="label" :title="hint">
      {{ label }}
    </div>
    <div class="value">
      <slot />
    </div>
  </div>
</template>

<style lang="scss">
.agui-property {
  display: flex;
  gap: 8px;
  align-items: center;

  &:not(.group) {
    margin-bottom: 4px;
  }

  .label {
    color: #eee;

    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .value {
    flex: 2;
  }
}
</style>
