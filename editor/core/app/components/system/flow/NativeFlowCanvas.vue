<script setup lang="ts">
import type { FlowEditCommand, FlowEditDocument, FlowEditPosition } from '@advjs/core'
import type { Connection, NodeDragEvent } from '@vue-flow/core'
import { flowEditGraph, isFlowEditRecord } from '@advjs/core'
import AGUIIconButton from '@advjs/gui/components/button/AGUIIconButton.vue'
import { Background } from '@vue-flow/background'
import { useVueFlow, VueFlow } from '@vue-flow/core'
import { computed, nextTick, useId, watch } from 'vue'
import NativeFlowNode from './NativeFlowNode.vue'

const props = defineProps<{ document: FlowEditDocument, selectedNodeId: string, disabled?: boolean, visible?: boolean }>()
const emit = defineEmits<{ edit: [command: FlowEditCommand], select: [nodeId: string] }>()
const flow = useVueFlow(useId())
const graph = computed(() => flowEditGraph(props.document))
const nodes = computed(() => {
  const items = graph.value.nodes.map((node, index) => ({ id: node.id, type: 'native', position: isFlowEditRecord(node.position) && [node.position.x, node.position.y].every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000000) ? node.position : { x: (index % 4) * 270, y: Math.floor(index / 4) * 180 }, selected: node.id === props.selectedNodeId, data: { node, entry: (props.document.startNodeId ?? props.document.nodes[0]?.id) === node.id } }))
  const portals = new Map(graph.value.edges.filter(edge => edge.target.chapterId !== props.document.id).map(edge => [`portal:${edge.target.chapterId}#${edge.target.nodeId}`, edge.target]))
  return [...items, ...[...portals].map(([id, target], index) => ({ id, type: 'native', position: { x: 1100, y: index * 180 }, draggable: false, selectable: false, connectable: false, data: { node: { id: `${target.chapterId}#${target.nodeId}`, type: 'start' }, entry: false, portal: true } }))]
})
const edges = computed(() => graph.value.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target.chapterId === props.document.id ? edge.target.nodeId : `portal:${edge.target.chapterId}#${edge.target.nodeId}`, sourceHandle: edge.choiceId ? `choice:${edge.choiceId}` : 'next', label: edge.label ? `${edge.label}${edge.when ? ` [${edge.when}]` : ''}` : edge.kind === 'implicit' ? '顺序' : undefined, style: { stroke: 'var(--agui-c-text-2)', ...(edge.kind === 'implicit' || edge.when ? { strokeDasharray: '4 3' } : {}) }, data: edge })))
function connect(connection: Connection) {
  if (!connection.source || !connection.target || connection.target.startsWith('portal:'))
    return
  emit('edit', { type: 'connect', nodeId: connection.source, target: connection.target, ...(connection.sourceHandle?.startsWith('choice:') ? { choiceId: connection.sourceHandle.slice(7) } : {}) })
}
function move(event: NodeDragEvent) {
  emit('edit', { type: 'move-node', nodeId: event.node.id, position: { ...event.node.position } as FlowEditPosition })
}
async function fit() {
  await nextTick()
  await flow.fitView({ padding: 0.15, maxZoom: 1 })
}
flow.onNodesInitialized(() => {
  void fit()
})
watch(() => [props.document.id, props.visible], () => {
  void fit()
})
</script>

<template>
  <div class="native-flow-canvas" data-testid="native-flow-canvas">
    <VueFlow :id="flow.id" :nodes="nodes" :edges="edges" :nodes-draggable="!disabled" :nodes-connectable="!disabled" :min-zoom="0.05" :max-zoom="3" @node-click="emit('select', $event.node.id)" @connect="connect" @node-drag-stop="move" @edge-double-click="emit('edit', { type: 'disconnect', nodeId: $event.edge.data.source, choiceId: $event.edge.data.choiceId })">
      <Background :gap="16" pattern-color="var(--agui-c-divider)" />
      <template #node-native="slot">
        <NativeFlowNode :data="slot.data" />
      </template>
    </VueFlow>
    <div class="native-canvas-controls">
      <AGUIIconButton icon="i-ri-add-line" title="放大" @click="flow.zoomIn()" />
      <AGUIIconButton icon="i-ri-subtract-line" title="缩小" @click="flow.zoomOut()" />
      <AGUIIconButton icon="i-ri-focus-3-line" title="显示全部节点" @click="fit" />
    </div>
  </div>
</template>

<style scoped>
.native-flow-canvas {
  position: relative;
  min-width: 0;
  min-height: 240px;
  height: 100%;
  background: var(--agui-c-bg-soft);
}
.native-canvas-controls {
  position: absolute;
  display: flex;
  bottom: 6px;
  left: 6px;
  background: var(--agui-c-bg-panel);
  border: 1px solid var(--agui-c-divider);
}
:deep(.vue-flow__edge-text) {
  fill: var(--agui-c-text-1);
  font-size: 11px;
}
:deep(.vue-flow__edge-textbg) {
  fill: var(--agui-c-bg-panel);
}
:deep(.vue-flow__node.selected .native-flow-node) {
  border-color: var(--agui-c-primary);
}
</style>
