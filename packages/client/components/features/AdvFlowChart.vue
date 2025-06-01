<script lang="ts" setup>
import { Background } from '@vue-flow/background'
import { Panel, useVueFlow, VueFlow } from '@vue-flow/core'
import { nextTick, ref } from 'vue'
import { useFlowLayout } from '../../../flow/composables/useFlowLayout'

import { initialEdges, initialNodes } from './temp-data'

const nodes = ref(initialNodes)

const edges = ref(initialEdges)

const { layout } = useFlowLayout()

const { fitView } = useVueFlow()

async function layoutGraph(direction: 'LR' | 'TB') {
  nodes.value = layout(nodes.value, edges.value, direction)

  nextTick(() => {
    fitView()
  })
}
</script>

<template>
  <div class="layout-flow size-full overflow-hidden">
    <VueFlow :nodes="nodes" :edges="edges" @nodes-initialized="layoutGraph('LR')">
      <Background bg-color="white" />

      <Panel class="process-panel" position="bottom-right">
        <div class="layout-panel">
          <button title="set horizontal layout" @click="layoutGraph('LR')">
            <div class="i-ri-expand-horizontal-s-line" />
          </button>

          <button title="set vertical layout" @click="layoutGraph('TB')">
            <div class="i-ri-expand-vertical-s-line" />
          </button>
        </div>
      </Panel>
    </VueFlow>
  </div>
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
