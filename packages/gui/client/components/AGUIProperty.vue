<script setup lang="ts">
defineProps<{
  label?: string
  hint?: string
  for?: string
  group?: boolean
  size?: 'mini' | '' | 'large'
}>()
</script>

<template>
  <div :class="[{ group }, size]" class="agui-property">
    <component :is="$props.for ? 'label' : 'div'" class="label" :for="$props.for" :title="hint">
      {{ label }}
    </component>
    <div class="value">
      <slot />
    </div>
  </div>
</template>

<style lang="scss">
.agui-property {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 8px;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  line-height: 1.5;

  &:not(.group) {
    margin-bottom: 4px;
  }

  &.mini {
    font-size: 11px;
  }

  > .label {
    min-width: 0;
    color: var(--agui-c-text-2);
    text-align: right;
    overflow-wrap: anywhere;
  }

  > .value {
    min-width: 0;
  }
}

@container agui-properties (max-width: 240px) {
  .agui-property {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;

    > .label {
      text-align: left;
    }
  }
}
</style>
