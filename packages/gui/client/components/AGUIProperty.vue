<script setup lang="ts">
import AGUIFormItem from './form/AGUIFormItem.vue'

defineProps<{
  label?: string
  hint?: string
  for?: string
  group?: boolean
  size?: 'mini' | '' | 'large'
  labelAlign?: 'left' | 'top'
}>()
</script>

<template>
  <AGUIFormItem :class="[{ group }, size]" class="agui-property" :label="label" :for="$props.for" :description="hint" :label-align="labelAlign">
    <slot />
  </AGUIFormItem>
</template>

<style lang="scss">
.agui-property {
  &.mini,
  &.mini > .label {
    font-size: var(--agui-font-size-caption);
  }
}
</style>
