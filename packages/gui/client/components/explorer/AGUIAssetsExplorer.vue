<script lang="ts" setup>
import './explorer.scss'

import { computed, ref } from 'vue'
import { Pane, Splitpanes } from 'splitpanes'
import { useEventListener } from '@vueuse/core'

import AGUITree from '../tree/AGUITree.vue'
import AGUISlider from '../AGUISlider.vue'
import { curDir, curFileList, getBreadcrumbItems, listFilesInDir, saveFile, tree } from '../../composables'
import AGUIBreadcrumb from '../breadcrumb/AGUIBreadcrumb.vue'
import { sortFSItems } from '../../utils'
import AGUIFileList from './AGUIFileList.vue'
import AGUIOpenDirectory from './AGUIOpenDirectory.vue'
import AGUIExplorerControls from './AGUIExplorerControls.vue'

import type { FSDirItem, FSFileItem, FSItem } from './types'

const props = withDefaults(defineProps<{
  fileList?: FSItem[]
  onFileDrop?: (files: FSFileItem[]) => void | Promise<void>
}>(), {
  fileList: [] as any,
})

const size = ref(64)
if (props.fileList)
  curFileList.value = props.fileList

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
    curDir.value = node as FSDirItem
    curFileList.value = list
  }
}

const breadcrumbItems = computed(() => {
  return getBreadcrumbItems(curDir.value)
})
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

  const fileItems: FSFileItem[] = []
  for (const file of files) {
    const handle = await curDirHandle.getFileHandle(file.name, {
      create: true,
    })
    fileItems.push({
      name: file.name,
      kind: 'file',
      file,
      handle,
      parent: curDir.value,
    })
  }

  const dir = curDir.value
  if (!dir)
    return

  if (props.onFileDrop) {
    await props.onFileDrop(fileItems)

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

    curFileList.value = sortFSItems(
      curFileList.value.concat(fileItems),
    )
  }
  else {
    for (const fileItem of fileItems) {
      if (fileItem.file)
        await saveFile(fileItem.file)
    }

    curFileList.value = await listFilesInDir(dir, {
      showFiles: true,
    })
  }
})
</script>

<template>
  <div class="agui-assets-explorer">
    <AGUIExplorerControls>
      <!-- <div class="i-ri-folder-line" @click="onOpenDir" /> -->
    </AGUIExplorerControls>
    <Splitpanes class="h-$agui-explorer-main-content-height!">
      <Pane size="20">
        <AGUITree
          v-if="tree"
          class="h-full w-full"
          :data="tree"
          @node-activate="onNodeActivated"
        />
        <AGUIOpenDirectory v-else />
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
