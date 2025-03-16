<script setup>
import { nodeTypes } from '@advjs/flow'
import { Background } from '@vue-flow/background'
import { ControlButton, Controls } from '@vue-flow/controls'
import { Panel, VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'

import { ref } from 'vue'

import './styles'

const flowStore = useFlowStore()

// our dark mode toggle flag
const dark = ref(true)
</script>

<template>
  <VueFlow
    v-model:nodes="flowStore.curItem.data.nodes"
    v-model:edges="flowStore.curItem.data.edges"
    :default-viewport="flowStore.curItem.data.viewport"
    :class="{ dark }"
    class="advjs-flow-editor"
    :min-zoom="0.2"
    :max-zoom="4"
    :node-types="nodeTypes"
    fit-view-on-init
  >
    <Background pattern-color="#aaa" :gap="16" />

    <MiniMap mask-color="rgba(0,0,0,0.1)" node-color="rgba(0,0,0,0.5)" />

    <Controls position="top-left">
      <ControlButton class="text-black" title="Refresh" @click="flowStore.refreshData">
        <div i-ri-refresh-line />
      </ControlButton>
    </Controls>

    <Panel class="process-panel" position="top-right">
      <div class="layout-panel">
        <button title="set horizontal layout" @click="layoutGraph('LR')">
          <div i-ri-arrow-right-s-line />
        </button>

        <button title="set vertical layout" @click="layoutGraph('TB')">
          <div i-ri-arrow-down-s-line />
        </button>
      </div>
    </Panel>
  </VueFlow>
</template>

<style>
.layout-flow {
  background-color: #1a192b;
  height: 100%;
  width: 100%;
}

.process-panel,
.layout-panel {
  display: flex;
  gap: 10px;
}

.process-panel {
  background-color: #2d3748;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.process-panel button {
  border: none;
  cursor: pointer;
  background-color: #4a5568;
  border-radius: 8px;
  color: white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.process-panel button {
  font-size: 16px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-panel {
  display: flex;
  align-items: center;
  gap: 10px;
}

.process-panel button:hover,
.layout-panel button:hover {
  background-color: #2563eb;
  transition: background-color 0.2s;
}

.process-panel label {
  color: white;
  font-size: 12px;
}

.stop-btn svg {
  display: none;
}

.stop-btn:hover svg {
  display: block;
}

.stop-btn:hover .spinner {
  display: none;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #2563eb;
  border-radius: 50%;
  width: 10px;
  height: 10px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
