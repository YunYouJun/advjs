<script lang="ts" setup>
import { ref } from 'vue'
import AGUIFileList from './AGUIFileList.vue'
import AGUIBreadcrumb from './AGUIBreadcrumb.vue'

withDefaults(defineProps<{
  height?: number
}>(), {
  height: 300,
})

const items = ref([
  { text: 'Assets', href: '#' },
  { text: 'Textures', href: '#' },
])
const size = ref(64)
</script>

<template>
  <div class="agui-assets-explorer">
    <AGUIBreadcrumb :items="items" />
    <div :style="`height:${height}px`" class="agui-explorer-content">
      <AGUIFileList :size="size" />
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

  .agui-explorer-content {
    padding: 8px;
    overflow-x: hidden;
    overflow-y: auto;
    background-color: var(--agui-c-bg-panel);
  }

  .agui-explorer-footer {
    display: flex;
    justify-content: right;

    padding: 8px;
    background-color: var(--agui-c-bg-panel-title);
  }
}
</style>
