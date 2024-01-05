<script lang="ts" setup>
import { ref } from 'vue'
import { Pane, Splitpanes } from 'splitpanes'
import { useEventListener } from '@vueuse/core'
import AGUITree from '../tree/AGUITree.vue'
import AGUIFileList from './AGUIFileList.vue'
import AGUIBreadcrumb from './AGUIBreadcrumb.vue'
import type { FileItem } from './types'
import { curFileList, listFilesInDirectory, onOpenDir, tree, vscodeFolderIcon } from './useAssetsExplorer'

const props = withDefaults(defineProps<{
  fileList?: FileItem[]
}>(), {
  fileList: [] as any,
})

const items = ref([
  { text: 'Assets', href: '#' },
  { text: 'Textures', href: '#' },
])
const size = ref(64)

if (props.fileList)
  curFileList.value = props.fileList

async function onNodeActivated(node: FileItem) {
  if (!node.handle)
    return

  const list = await listFilesInDirectory(node.handle, {
    showFiles: true,
  })
  curFileList.value = list
}

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

useEventListener(explorerContent, 'drop', (e) => {
  isDragging.value = false
  e.preventDefault()
  e.stopPropagation()
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

        <div v-else class="h-full w-full flex flex-col items-center justify-center">
          <div class="cursor-pointer text-6xl">
            <div
              :class="vscodeFolderIcon"
              @click="onOpenDir"
            />
          </div>
          <div class="text-base">
            Open a directory to start
          </div>
        </div>
      </Pane>

      <Pane>
        <div class="agui-assets-panel">
          <AGUIBreadcrumb :items="items" />

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

    .is-dragging {
      opacity: 0.5;
      background-color: rgba(0, 0, 0, 0.5);
    }

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
