<script setup lang="ts">
defineProps<{
  label?: string
  hint?: string
  group?: boolean
  size?: 'mini' | '' | 'large'
}>()
</script>

<template>
  <div :class="{ group, size }" class="agui-property">
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
  font-size: 0.75rem;
  line-height: 1rem;

  &:not(.group) {
    margin-bottom: 4px;
  }

  &.mini {
    font-size: 0.625rem;
    line-height: 0.75rem;
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
    // 0 for truncate text
    width: 0;
    flex: 2;
  }
}
</style>
