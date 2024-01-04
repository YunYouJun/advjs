<script lang="ts" setup>
import { ref } from 'vue'
import { Pane, Splitpanes } from 'splitpanes'
import AGUITree from '../tree/AGUITree.vue'
import AGUIFileList from './AGUIFileList.vue'
import AGUIBreadcrumb from './AGUIBreadcrumb.vue'
import type { FileItem } from './types'

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

const curFileList = ref(props.fileList || [])

const tree = ref(
  {
    id: '1',
    name: 'Assets',
    children: [
      {
        id: '1-1',
        name: 'Textures',
        children: [
          {
            id: '1-1-1',
            name: 'Texture1',
          },
          {
            id: '1-1-2',
            name: 'Texture2',
          },
        ],
      },
      {
        id: '1-2',
        name: 'Materials',
        children: [
          {
            id: '1-2-1',
            name: 'Material1',
          },
          {
            id: '1-2-2',
            name: 'Material2',
          },
        ],
      },
    ],
  },
)

async function onOpenDir() {
  try {
    const dir = await window.showDirectoryPicker()

    // directory handle 转换为树结构
    // console.log(dir.entries())
    for await (const [name, _handle] of dir.entries()) {
      curFileList.value.push({
        filename: name,
      })
    }
  }
  catch (err) {
    // console.log(err)
  }
}
</script>

<template>
  <div class="agui-assets-explorer">
    <AGUIExplorerControls>
      <AGUIIconButton icon="i-ri-folder-line" @click="onOpenDir" />
    </AGUIExplorerControls>
    <Splitpanes>
      <Pane size="20">
        <AGUITree class="h-full w-full" :data="tree" />
      </Pane>

      <Pane>
        <div class="agui-assets-panel">
          <AGUIBreadcrumb :items="items" />
          <div class="agui-explorer-content">
            <div class="h-full p-2">
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

  --agui-explorer-footer-height: 26px;

  .agui-assets-panel {
    display: flex;
    flex-direction: column;

    width: 100%;
    height: 100%;
  }

  .agui-explorer-content {
    position: relative;

    max-height: calc(100% - 20px - var(--agui-explorer-footer-height));

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
