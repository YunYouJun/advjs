<script lang="ts" setup>
import type { AGUIContextMenuItemType } from '../context-menu/types'
import type { TreeNode } from '../tree/types'
import type { AGUIAssetsExplorerProps, FSDirItem, FSFileItem, FSItem } from './types'

import { useEventListener } from '@vueuse/core'
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
} from 'reka-ui'
import { Pane, Splitpanes } from 'splitpanes'
import { computed, onMounted, provide, ref, watch } from 'vue'

import { AGUIAssetsExplorerSymbol, listFilesInDir, openRootDir as openRootDirUtil, saveFile, useAGUIAssetsExplorer } from '../../composables'
import { getEmptyAreaContextMenu } from '../../composables/useExplorerContextMenu'
import { useExplorerKeyboard } from '../../composables/useExplorerKeyboard'
import { useFileOperations } from '../../composables/useFileOperations'
import { useFileSelection } from '../../composables/useFileSelection'
import { getTreeNodeContextMenu } from '../../composables/useTreeContextMenu'
import { sortFSItems } from '../../utils'
import AGUISlider from '../AGUISlider.vue'
import AGUIBreadcrumb from '../breadcrumb/AGUIBreadcrumb.vue'
import AGUIContextMenuItem from '../context-menu/AGUIContextMenuItem.vue'
import AGUITree from '../tree/AGUITree.vue'
import AGUIExplorerControls from './AGUIExplorerControls.vue'
import AGUIFileList from './AGUIFileList.vue'
import AGUIOpenDirectory from './AGUIOpenDirectory.vue'

import './explorer.scss'

const props = defineProps<AGUIAssetsExplorerProps>()

const emit = defineEmits([
  'treeNodeActivate',
  'openRootDir',

  'update:rootDir',
  'update:curDir',
  'update:curFileList',
  'update:tree',
])

const numberAfterSpacePattern = /(?<=\s)\d+/

const rootDir = ref<FSDirItem | undefined>(props.rootDir)
const curDir = ref<FSDirItem | undefined>(props.curDir)
const curFileList = ref<FSItem[]>(props.curFileList || [])
const tree = ref(props.tree || {})

function setRootDir(dir: FSDirItem) {
  rootDir.value = dir
  emit('update:rootDir', dir)
}

function setCurDir(dir: FSDirItem) {
  curDir.value = dir
  emit('update:curDir', dir)
}

function setCurFileList(list: FSItem[]) {
  curFileList.value = list
  emit('update:curFileList', list)
}

const selection = useFileSelection()

async function refreshCurrentDir() {
  const dir = curDir.value
  if (!dir)
    return
  const list = await listFilesInDir(dir, { showFiles: true })
  setCurFileList(list)
}

const state = {
  rootDir,
  curDir,
  curFileList,
  tree,

  selection,

  beforeOpenRootDir: props.beforeOpenRootDir,
  onDblClick: props.onDblClick,
  onFileDblClick: props.onFileDblClick,
  onDirDblClick: props.onDirDblClick,
  onOpenRootDir: props.onOpenRootDir,
  onFSItemChange: props.onFSItemChange,
  onRename: props.onRename,
  onDelete: props.onDelete,
  onCreate: props.onCreate,

  emit,

  setCurDir,
  setCurFileList,
  setRootDir,
  refreshCurrentDir,
}
provide(AGUIAssetsExplorerSymbol, state)
defineExpose(state)

const ops = useFileOperations(state)

/**
 * Watch for external rootDir changes (e.g. after project creation)
 * to sync internal state and populate the file tree.
 */
watch(() => props.rootDir, async (newRootDir) => {
  if (newRootDir && newRootDir !== rootDir.value && newRootDir.handle) {
    await openRootDirUtil(newRootDir.handle, state)
  }
  else if (!newRootDir) {
    rootDir.value = undefined
    curDir.value = undefined
    curFileList.value = []
    tree.value = {}
  }
})

const size = ref(64)

/**
 * click dir in tree
 */
async function onNodeActivated(node: FSItem) {
  if (!node.handle)
    return

  if (node.handle.kind === 'directory') {
    const list = await listFilesInDir(node as FSDirItem, {
      showFiles: true,
    })

    setCurDir(node as FSDirItem)
    setCurFileList(list)
  }

  emit('treeNodeActivate', node)
}

/**
 * Generate context menu items for a tree node
 */
function getTreeContextMenu(node: TreeNode): AGUIContextMenuItemType[] {
  return getTreeNodeContextMenu(node, ops, selection, state)
}

/**
 * Double-click handler for tree nodes
 * - Directory: expand node + navigate to directory
 * - File: trigger file open callback
 */
async function onTreeNodeDblClick(node: TreeNode) {
  const item = node as unknown as FSItem
  const isDirectory = item.kind === 'directory' || node.handle?.kind === 'directory'

  if (isDirectory) {
    node.expanded = true
    if (item.handle) {
      const list = await listFilesInDir(item as FSDirItem, { showFiles: true })
      setCurDir(item as FSDirItem)
      setCurFileList(list)
    }
  }
  else {
    if (state.onFileDblClick) {
      state.onFileDblClick(item)
    }
    else if (state.onDblClick) {
      state.onDblClick(item)
    }
  }
}

const { breadcrumbItems } = useAGUIAssetsExplorer(state)
const explorerContent = ref<HTMLDivElement>()

// Initialize keyboard shortcuts
watch(explorerContent, (el) => {
  if (el)
    useExplorerKeyboard(state, ops, explorerContent)
}, { immediate: true })

const isDragging = ref(false)
useEventListener(explorerContent, 'dragover', (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
})

function onDragLeave() {
  isDragging.value = false
}
useEventListener(explorerContent, 'dragleave', onDragLeave)
useEventListener(explorerContent, 'dragend', onDragLeave)

useEventListener(explorerContent, 'drop', async (e: DragEvent) => {
  isDragging.value = false
  e.preventDefault()
  e.stopPropagation()

  const files = e.dataTransfer?.files
  if (!files)
    return

  const curDirHandle = curDir.value?.handle
  if (!curDirHandle)
    return

  let fileItems: FSFileItem[] = []

  const filesArray = Array.from(files)
  for (const file of filesArray) {
    fileItems.push({
      name: file.name,
      kind: 'file',
      file,
      parent: curDir.value,
    })
  }

  const dir = curDir.value
  if (!dir)
    return

  if (props.onFileDrop) {
    fileItems = await props.onFileDrop(fileItems)

    // solve file name conflict
    const sameNameItems = fileItems.filter((fi) => {
      return curFileList.value.find((ci) => {
        return fi.name === ci.name
      })
    })

    // index++
    sameNameItems.forEach((item) => {
      let name = item.name
      let rawName = name

      // get index from name
      // for example: 'test 1.png' index is 1
      let index = 1
      const match = name.match(numberAfterSpacePattern)
      if (match) {
        index = Number.parseInt(match[0])
        rawName = name.replace(match[0], '')
      }

      while (curFileList.value.some(i => i.name === name)) {
        // handle suffix
        const ext = item.name.split('.').pop()
        name = `${rawName.replace(`.${ext}`, '')} ${index}.${ext}`
        index++
      }
      item.name = name
    })

    setCurFileList(sortFSItems(
      [...curFileList.value, ...fileItems],
    ))
  }
  else {
    for (const fileItem of fileItems) {
      if (fileItem.file)
        await saveFile(fileItem.file, curDirHandle)
    }

    setCurFileList(await listFilesInDir(dir, {
      showFiles: true,
    }))
  }
})

// Footer selection info
const footerInfo = computed(() => {
  const count = selection.selectedItems.size
  if (count > 1)
    return `${count} items selected`
  return ''
})

// Empty area context menu (standalone, no nesting with per-item menus)
const emptyAreaMenuItems = ref<AGUIContextMenuItemType[]>([])
function onEmptyAreaContextMenu() {
  emptyAreaMenuItems.value = getEmptyAreaContextMenu(ops, selection)
}

onMounted(() => {
  window.AGUI_DRAGGING_ITEM_MAP = new Map()
})
</script>

<template>
  <div class="agui-assets-explorer">
    <AGUIExplorerControls />
    <Splitpanes style="height: calc(100% - var(--agui-explorer-controls-height));">
      <Pane size="24">
        <div class="tree-container h-full w-full overflow-auto">
          <AGUITree
            v-if="tree && rootDir"
            class="h-full w-full"
            :data="tree"
            :context-menu="getTreeContextMenu"
            @node-activate="onNodeActivated"
            @node-dblclick="onTreeNodeDblClick"
          />
          <AGUIOpenDirectory v-else :on-open-root-dir="onOpenRootDir" />
        </div>
      </Pane>

      <Pane>
        <div class="agui-assets-panel">
          <AGUIBreadcrumb :items="breadcrumbItems" />

          <ContextMenuRoot>
            <ContextMenuTrigger as-child @contextmenu="onEmptyAreaContextMenu">
              <div ref="explorerContent" class="agui-explorer-content" tabindex="0">
                <div
                  class="h-full p-2" :class="{
                    'is-dragging': isDragging,
                  }"
                >
                  <AGUIFileList :size="size" :list="curFileList" />
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuPortal>
              <ContextMenuContent class="ContextMenuContent" :side-offset="5">
                <AGUIContextMenuItem
                  v-for="menuItem in emptyAreaMenuItems"
                  :key="menuItem.id || menuItem.label"
                  :item="menuItem"
                />
              </ContextMenuContent>
            </ContextMenuPortal>
          </ContextMenuRoot>

          <div class="agui-explorer-footer">
            <span v-if="footerInfo" class="agui-explorer-selection-info">{{ footerInfo }}</span>
            <AGUISlider v-model="size" style="width:120px" :max="120" :min="12" />
          </div>
        </div>
      </Pane>
    </Splitpanes>
  </div>
</template>
