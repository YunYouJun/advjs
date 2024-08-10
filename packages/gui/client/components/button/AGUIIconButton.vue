<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{
  active?: boolean
  icon?: string
  size?: 'mini' | '' | 'large'
}>()

const classes = computed(() => {
  const cls: string[] = []
  if (props.active)
    cls.push('active')
  if (props.size)
    cls.push(props.size)
  return cls
})
</script>

<template>
  <button
    class="agui-icon-button inline-flex rounded bg-$agui-c-bg-1 text-xs hover:bg-$agui-c-bg-2"
    items-center justify-center
    :class="classes"
  >
    <slot>
      <div :class="icon" />
    </slot>
  </button>
</template>

<style lang="scss">
.agui-icon-button {
  cursor: pointer;
  padding: 6px;

  &.active {
    background-color: var(--agui-c-active);
  }

  &.mini {
    //
    font-size: 9px;
    padding: 4px;
  }
}
</style>
