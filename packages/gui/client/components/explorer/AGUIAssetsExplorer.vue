<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Pane, Splitpanes } from 'splitpanes'
import { useEventListener } from '@vueuse/core'

import AGUITree from '../tree/AGUITree.vue'
import AGUISlider from '../AGUISlider.vue'
import { curDirHandle, curFileList, listFilesInDirectory, saveFile, tree } from '../../composables'
import AGUIFileList from './AGUIFileList.vue'
import AGUIBreadcrumb from './AGUIBreadcrumb.vue'
import AGUIOpenDirectory from './AGUIOpenDirectory.vue'
import AGUIExplorerControls from './AGUIExplorerControls.vue'

import type { FileItem } from './types'

const props = withDefaults(defineProps<{
  fileList?: FileItem[]
  onFileDrop?: (files: FileItem[]) => void
}>(), {
  fileList: [] as any,
})

const size = ref(64)

if (props.fileList)
  curFileList.value = props.fileList

async function onNodeActivated(node: FileItem) {
  const handle = node.handle
  if (!handle)
    return

  if (handle.kind === 'directory') {
    const list = await listFilesInDirectory(handle, {
      showFiles: true,
    })
    curDirHandle.value = handle
    curFileList.value = list
  }
}

const breadcrumbItems = computed(() => {
  return curDirHandle.value?.name
    ? [
        {
          label: curDirHandle.value.name,
          handle: curDirHandle.value,
        },
      ]
    : []
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
  // const handles = files.map(item => item.getAsFileSystemHandle())

  const fileItems: FileItem[] = []
  for (const file of files) {
    fileItems.push({
      name: file.name,
      filename: file.name,
      file,
    })
  }

  if (props.onFileDrop) {
    props.onFileDrop(fileItems)
  }
  else {
    for (const fileItem of fileItems) {
      if (fileItem.file)
        await saveFile(fileItem.file)
    }
  }

  curFileList.value = await listFilesInDirectory(curDirHandle.value!, {
    showFiles: true,
  })
})
</script>

<template>
  <div class="agui-assets-explorer">
    <AGUIExplorerControls>
      <!-- <div class="i-ri-folder-line" @click="onOpenDir" /> -->
    </AGUIExplorerControls>
    <Splitpanes style="height: calc(100% - var(--agui-explorer-controls-height, 32px));">
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

<style lang="scss">
.agui-assets-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;

  --agui-explorer-controls-height: 32px;
  --agui-explorer-footer-height: 26px;

  .agui-assets-panel {
    display: flex;
    flex-direction: column;

    width: 100%;
    height: 100%;
  }

  .agui-explorer-content {
    position: relative;
    display: flex;
    flex-direction: column;
    flex-grow: 1;

    // padding: 8px;
    overflow-x: hidden;
    overflow-y: auto;
    background-color: var(--agui-c-bg-panel);

    /* 整个滚动条 */
    &::-webkit-scrollbar {
      width: 10px; /* 滚动条的宽度 */
      height: 10px; /* 滚动条的高度，水平滚动条时使用 */
    }

    /* 滚动条轨道 */
    &::-webkit-scrollbar-track {
      background: #333; /* 轨道的颜色 */
    }

    /* 滚动条的滑块 */
    &::-webkit-scrollbar-thumb {
      border-radius: 4px;
      background: #888; /* 滑块的颜色 */
    }

    /* 滑块hover效果 */
    &::-webkit-scrollbar-thumb:hover {
      background: #555; /* 滑块hover时的颜色 */
    }
  }

  .agui-explorer-footer {
    display: flex;
    justify-content: right;

    padding: 8px;

    height: var(--agui-explorer-footer-height);
    background-color: var(--agui-c-bg-panel-title);
  }
}
</style>
../../composables/useAssetsExplorer
