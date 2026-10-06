<script lang="ts" setup>
import type { FSDirItem, FSItem } from './types'
import { computed, shallowRef } from 'vue'
import { useAGUIAssetsExplorerState } from '../../composables'
import { getDirContextMenu, getFileContextMenu } from '../../composables/useExplorerContextMenu'
import { useFileOperations } from '../../composables/useFileOperations'
import AGUIContextMenu from '../context-menu/AGUIContextMenu.vue'
import AGUIFileItem from './AGUIFileItem.vue'

const props = withDefaults(defineProps<{
  list?: FSItem[]
  label?: string
  /**
   * The size of the icon.
   * @default 32
   * px
   */
  size?: number
}>(), {
  list: () => [],
  label: 'Files',
  size: 32,
})

const state = useAGUIAssetsExplorerState()
const ops = useFileOperations(state)
const { selection } = state
const container = shallowRef<HTMLElement>()
const focusedItem = shallowRef<FSItem>()
const tabStop = computed(() => props.list.find(item => item === focusedItem.value)
  ?? props.list.find(item => selection.isSelected(item)) ?? props.list[0])
function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented || (event.target as HTMLElement).closest('input, textarea, [contenteditable="true"]'))
    return
  const items = Array.from(container.value?.querySelectorAll<HTMLElement>('.agui-file-item') ?? [])
  const index = items.indexOf(event.target as HTMLElement)
  if (index < 0)
    return
  let next = index
  const nextRow = items.findIndex(item => item.offsetTop > items[0].offsetTop)
  const columns = props.size >= 32 ? (nextRow > 0 ? nextRow : items.length) : 1
  switch (event.key) {
    case 'ArrowDown': next += columns
      break
    case 'ArrowUp': next -= columns
      break
    case 'ArrowRight': next++
      break
    case 'ArrowLeft': next--
      break
    case 'Home': next = 0
      break
    case 'End': next = items.length - 1
      break
    case ' ':
      selection.toggleSelect(props.list[index])
      break
    case 'Enter':
      items[index].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      break
    default: return
  }
  event.preventDefault()
  event.stopPropagation()
  if (next !== index && items[next]) {
    items[next].focus()
    if (event.shiftKey)
      selection.rangeSelect(props.list[next], props.list)
    else if (!event.ctrlKey && !event.metaKey)
      selection.select(props.list[next])
  }
}

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
    ref="container"
    class="agui-file-list"
    role="listbox"
    aria-multiselectable="true"
    :aria-label="label"
    :tabindex="list.length ? -1 : 0"
    :class="classes"
    :style="cssVars"
    @keydown="onKeydown"
    @click="onListClick"
    @agui-rename="onRenameEvent"
  >
    <p v-if="!list.length" class="agui-file-list-empty" role="status">
      No files
    </p>
    <template v-else>
      <AGUIContextMenu v-for="(item, i) in fileList" :key="i" :context-menu="getContextMenuForItem(item)">
        <template #trigger>
          <AGUIFileItem
            :size="size" :item="item" :selectable-items="list"
            :tabindex="tabStop === item ? 0 : -1"
            @focus="focusedItem = item"
          />
        </template>
      </AGUIContextMenu>
    </template>
  </div>
</template>

<style lang="scss">
.agui-file-list {
  min-width: 0;
  min-height: 100%;
  align-content: start;
  &:focus-visible {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }
  .agui-file-list-empty {
    grid-column: 1 / -1;
    padding: 8px;
    color: var(--agui-c-text-2);
    font-size: 12px;
  }

  &.with-thumbnail {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(max(80px, calc(var(--icon-size) + 8px)), 1fr));
    gap: 4px;
  }
}
</style>
