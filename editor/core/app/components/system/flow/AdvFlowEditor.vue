<script setup lang="ts">
import { nodeTypes } from '@advjs/flow'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { Panel, VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'

import './styles'

const flowStore = useFlowStore()

const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
</script>

<template>
  <VueFlow
    v-model:nodes="flowStore.curItem.data.nodes"
    v-model:edges="flowStore.curItem.data.edges"
    :default-viewport="flowStore.curItem.data.viewport"
    class="advjs-flow-editor"
    :min-zoom="0.2"
    :max-zoom="4"
    :node-types="nodeTypes"
    :nodes-draggable="false"
    :nodes-connectable="false"
    :elements-selectable="false"
    fit-view-on-init
  >
    <Background pattern-color="var(--agui-c-divider)" :gap="16" />

    <MiniMap mask-color="var(--agui-c-divider-light)" node-color="var(--agui-c-text-2)" />

    <Controls position="bottom-left" />
    <Panel class="flow-actions" position="top-right">
      <AGUIButton icon="i-ri-refresh-line" :title="zh ? '刷新' : 'Refresh'" :aria-label="zh ? '刷新' : 'Refresh'" @click="flowStore.refreshData" />
      <AGUIButton icon="i-ri-arrow-right-s-line" :title="zh ? '水平布局' : 'Horizontal layout'" :aria-label="zh ? '水平布局' : 'Horizontal layout'" @click="flowStore.layoutGraph('LR')" />
      <AGUIButton icon="i-ri-arrow-down-s-line" :title="zh ? '垂直布局' : 'Vertical layout'" :aria-label="zh ? '垂直布局' : 'Vertical layout'" @click="flowStore.layoutGraph('TB')" />
    </Panel>
  </VueFlow>
</template>

<style scoped>
.advjs-flow-editor {
  background: var(--agui-c-bg-soft);
  color: var(--agui-c-text-1);
}
.flow-actions {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin: 8px;
  background: var(--agui-c-bg-panel);
  border: 1px solid var(--agui-c-divider);
  border-radius: 2px;
}
:deep(.vue-flow__controls) {
  box-shadow: none;
  border: 1px solid var(--agui-c-divider);
}
:deep(.vue-flow__controls-button) {
  width: 24px;
  height: 24px;
  padding: 4px;
  color: var(--agui-c-text-1);
  background: var(--agui-c-control);
  border-color: var(--agui-c-divider);
}
:deep(.vue-flow__controls-button:hover) {
  background: var(--agui-c-control-hover);
}
:deep(.vue-flow__controls-button svg) {
  fill: currentColor;
}
:deep(.vue-flow__controls-button:focus-visible) {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: -2px;
}
:deep(.vue-flow__minimap) {
  background: var(--agui-c-bg-panel);
  border: 1px solid var(--agui-c-divider);
}
</style>
