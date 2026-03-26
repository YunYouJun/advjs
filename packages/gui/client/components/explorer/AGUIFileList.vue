<script lang="ts" setup>
import type { FSDirItem, FSItem } from './types'
import { computed } from 'vue'
import { useAGUIAssetsExplorerState } from '../../composables'
import { getDirContextMenu, getFileContextMenu } from '../../composables/useExplorerContextMenu'
import { useFileOperations } from '../../composables/useFileOperations'
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

const state = useAGUIAssetsExplorerState()
const ops = useFileOperations(state)
const { selection } = state

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

function getContextMenuForItem(item: FSItem) {
  if (item.kind === 'directory')
    return getDirContextMenu(item as FSDirItem, ops, selection, state)
  return getFileContextMenu(item, ops, selection, state)
}

function onListClick(e: MouseEvent) {
  // Only clear selection when clicking directly on the list container (empty area)
  if ((e.target as HTMLElement).classList.contains('agui-file-list'))
    selection.clearSelection()
}

function onRenameEvent(e: Event) {
  const detail = (e as CustomEvent).detail
  if (detail?.item && detail?.newName)
    ops.renameItem(detail.item, detail.newName)
}
</script>

<template>
  <div
    class="agui-file-list"
    :class="classes"
    :style="cssVars"
    @click="onListClick"
    @agui-rename="onRenameEvent"
  >
    <template v-if="list">
      <AGUIContextMenu v-for="(item, i) in fileList" :key="i" :context-menu="getContextMenuForItem(item)">
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
  min-height: 100%;

  &.with-thumbnail {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--icon-size), 1fr));
    grid-gap: 2px;
  }
}
</style>
