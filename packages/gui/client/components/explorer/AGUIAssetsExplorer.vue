<script lang="ts" setup>
import { ref } from 'vue'
import AGUIFileList from './AGUIFileList.vue'
import AGUIBreadcrumb from './AGUIBreadcrumb.vue'
import type { FileItem } from './types'

defineProps<{
  fileList: FileItem[]
}>()

const items = ref([
  { text: 'Assets', href: '#' },
  { text: 'Textures', href: '#' },
])
const size = ref(64)
</script>

<template>
  <div class="agui-assets-explorer">
    <AGUIBreadcrumb :items="items" />
    <div class="agui-explorer-content">
      <div class="h-full p-2">
        <AGUIFileList :size="size" :list="fileList" />
      </div>
    </div>
    <div class="agui-explorer-footer">
      <AGUISlider v-model="size" style="width:120px" :max="120" :min="12" />
    </div>
  </div>
</template>

<style lang="scss">
.agui-assets-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;

  --agui-explorer-footer-height: 26px;

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
