<script lang="ts" setup>
import { computed } from 'vue'
import type { FileItem } from './types'

const props = withDefaults(defineProps<{
  list?: FileItem[]
  /**
   * The size of the icon.
   * @default 32
   * px
   */
  size?: number
}>(), {
  list: [] as any,
  size: 32,
})

const cssVars = computed(() => ({
  '--icon-size': `${props.size}px`,
}))

const classes = computed(() => {
  if (props.size >= 32)
    return 'with-thumbnail'

  return ''
})

const fileList = computed(() => {
  return props.list
})
</script>

<template>
  <div class="agui-file-list" :class="classes" :style="cssVars">
    <template v-if="list">
      <AGUIFileItem v-for="(item, i) in fileList" :key="i" :size="size" :item="item" />
    </template>
  </div>
</template>

<style lang="scss">
.agui-file-list {
  &.with-thumbnail {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--icon-size), 1fr));
    grid-gap: 2px;
  }
}
</style>
