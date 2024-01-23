<script lang="ts" setup>
import './explorer.scss'

import { onMounted, provide, ref } from 'vue'
import { Pane, Splitpanes } from 'splitpanes'
import { useEventListener } from '@vueuse/core'

import AGUITree from '../tree/AGUITree.vue'
import AGUISlider from '../AGUISlider.vue'
import { AGUIAssetsExplorerSymbol, listFilesInDir, saveFile, useAGUIAssetsExplorer } from '../../composables'
import AGUIBreadcrumb from '../breadcrumb/AGUIBreadcrumb.vue'
import { sortFSItems } from '../../utils'
import AGUIFileList from './AGUIFileList.vue'
import AGUIOpenDirectory from './AGUIOpenDirectory.vue'
import AGUIExplorerControls from './AGUIExplorerControls.vue'

import type { FSDirItem, FSFileItem, FSItem } from './types'

const props = defineProps<{
  /**
   * init folder
   */
  rootDir?: FSDirItem
  curDir?: FSDirItem
  /**
   * current file list
   */
  curFileList?: FSItem[]
  tree?: any
  /**
   * when open root dir
   */
  onOpenRootDir?: (dir: FSDirItem) => void | Promise<void>
  onFileDrop?: (files: FSFileItem[]) => (FSFileItem[] | Promise<FSFileItem[]>)
  onDblClick?: (item: FSItem) => void | Promise<void>
  /**
   * dblclick file in file list
   */
  onFileDblClick?: (item: FSFileItem) => void | Promise<void>
  /**
   * dblclick dir in file list
   */
  onDirDblClick?: (item: FSDirItem) => void | Promise<void>
  /**
   * on FileItem change
   */
  onFSItemChange?: (item: FSItem) => void | Promise<void>
}>()

const emit = defineEmits([
  'treeNodeActivate',
  'openRootDir',

  'update:rootDir',
  'update:curDir',
  'update:curFileList',
  'update:tree',
])

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

const state = {
  rootDir,
  curDir,
  curFileList,
  tree,

  onDblClick: props.onDblClick,
  onFileDblClick: props.onFileDblClick,
  onDirDblClick: props.onDirDblClick,
  onOpenRootDir: props.onOpenRootDir,
  onFSItemChange: props.onFSItemChange,

  emit,

  setCurDir,
  setCurFileList,
  setRootDir,
}
provide(AGUIAssetsExplorerSymbol, state)
defineExpose(state)

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

const { breadcrumbItems } = useAGUIAssetsExplorer(state)
const explorerContent = ref<HTMLDivElement>()

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

useEventListener(explorerContent, 'drop', async (e) => {
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
      const match = name.match(/(?<=\s)\d+/)
      if (match) {
        index = Number.parseInt(match[0])
        rawName = name.replace(match[0], '')
      }

      while (curFileList.value.find(i => i.name === name)) {
        // handle suffix
        const ext = item.name.split('.').pop()
        name = `${rawName.replace(`.${ext}`, '')} ${index}.${ext}`
        index++
      }
      item.name = name
    })

    setCurFileList(sortFSItems(
      curFileList.value.concat(fileItems),
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
            @node-activate="onNodeActivated"
          />
          <AGUIOpenDirectory v-else :on-open-root-dir="onOpenRootDir" />
        </div>
      </Pane>

      <Pane>
        <div class="agui-assets-panel">
          <AGUIBreadcrumb :items="breadcrumbItems" />

          <div ref="explorerContent" class="agui-explorer-content">
            <div
              class="h-full p-2" :class="{
                'is-dragging': isDragging,
              }"
            >
              <AGUIFileList :size="size" :list="curFileList" />
            </div>
          </div>

          <div class="agui-explorer-footer">
            <AGUISlider v-model="size" style="width:120px" :max="120" :min="12" />
          </div>
        </div>
      </Pane>
    </Splitpanes>
  </div>
</template>
