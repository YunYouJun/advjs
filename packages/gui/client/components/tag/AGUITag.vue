<script lang="ts" setup>
defineProps<{
  closable?: boolean
  theme?: 'default' | 'primary' | 'danger'
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
    }"
  >
    <slot />
    <button
      v-if="closable"
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
  color: #e6e6e6;

  &--default {
    background-color: rgba(60, 60, 60, 1);
  }

  &--primary {
    background-color: rgba(71, 114, 179, 0.3);
    color: #7ba4d9;
  }

  &--danger {
    background-color: rgba(179, 71, 71, 0.3);
    color: #d97b7b;
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
  }
}
</style>
