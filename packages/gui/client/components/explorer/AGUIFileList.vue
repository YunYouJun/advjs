<script lang="ts" setup>
import type { FSItem } from './types'
import { computed } from 'vue'
import AGUIContextMenu from '../context-menu/AGUIContextMenu.vue'
import AGUIFileItem from './AGUIFileItem.vue'

const props = withDefaults(defineProps<{
  list?: FSItem[]
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
      <AGUIContextMenu v-for="(item, i) in fileList" :key="i">
        <template #trigger>
          <AGUIFileItem
            :size="size" :item="item"
          />
        </template>
      </AGUIContextMenu>
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
