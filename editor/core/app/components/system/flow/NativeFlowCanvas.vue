<script setup lang="ts">
import type { FlowEditCommand, FlowEditDocument, FlowEditPosition } from '@advjs/core'
import type { Connection, NodeDragEvent } from '@vue-flow/core'
import { flowEditGraph, flowEditTargetAddress, isFlowEditRecord } from '@advjs/core'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIIconButton from '@advjs/gui/components/button/AGUIIconButton.vue'
import { Background } from '@vue-flow/background'
import { MarkerType, useVueFlow, VueFlow } from '@vue-flow/core'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch } from 'vue'
import { layoutNativeFlow } from '../../../utils/native-flow-layout'
import NativeFlowEdge from './NativeFlowEdge.vue'
import NativeFlowNode from './NativeFlowNode.vue'

const props = defineProps<{ document: FlowEditDocument, selectedNodeId: string, disabled?: boolean, visible?: boolean }>()
const emit = defineEmits<{ edit: [command: FlowEditCommand], select: [nodeId: string] }>()
const flow = useVueFlow(useId())
const graph = computed(() => flowEditGraph(props.document))
const positions = shallowRef(new Map<string, FlowEditPosition>())
const mode = ref<'focus' | 'overview' | 'manual'>('focus')
let request = 0
let disposed = false
const items = computed(() => {
  const ids = new Set(props.document.nodes.map(node => node.id))
  const invalidTarget = (target: unknown) => {
    const address = flowEditTargetAddress(target, props.document.id)
    return !address || (address.chapterId === props.document.id && !ids.has(address.nodeId))
  }
  const local = graph.value.nodes.map(node => ({ id: node.id, type: 'native', data: {
    node,
    entry: (props.document.startNodeId ?? props.document.nodes[0]?.id) === node.id,
    invalid: (node.next != null && invalidTarget(node.next)) || (Array.isArray(node.choices) && node.choices.some(choice => !isFlowEditRecord(choice) || invalidTarget(choice.target))),
  } }))
  const portals = new Map(graph.value.edges.filter(edge => edge.target.chapterId !== props.document.id).map(edge => [`portal:${edge.target.chapterId}#${edge.target.nodeId}`, edge.target]))
  return [...local, ...[...portals].map(([id, target]) => ({ id, type: 'native', draggable: false, selectable: false, connectable: false, data: { node: { id: `${target.chapterId}#${target.nodeId}`, type: 'start' }, entry: false, invalid: false, portal: true } }))]
})
const nodes = computed(() => items.value.map((node, index) => ({ ...node, position: positions.value.get(node.id) ?? { x: index * 404, y: 0 }, selected: node.id === props.selectedNodeId })))
const obstacles = computed(() => nodes.value.map((node) => {
  const live = flow.findNode(node.id)
  return { id: node.id, ...(live?.computedPosition ?? node.position), width: live?.dimensions.width || 260, height: live?.dimensions.height || 160 }
}))
const edges = computed(() => {
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  const nodesById = new Map(props.document.nodes.map(node => [node.id, node]))
  const targetKey = (edge: typeof graph.value.edges[number]) => JSON.stringify(edge.target)
  for (const edge of graph.value.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.id])
    incoming.set(targetKey(edge), [...(incoming.get(targetKey(edge)) ?? []), edge.id])
  }
  return graph.value.edges.map((edge) => {
    const siblings = [...new Set([...(outgoing.get(edge.source) ?? []), ...(incoming.get(targetKey(edge)) ?? [])])]
    const laneIndex = siblings.indexOf(edge.id)
    const node = nodesById.get(edge.source)
    const choiceIndex = Array.isArray(node?.choices) ? node.choices.findIndex(choice => isFlowEditRecord(choice) && choice.id === edge.choiceId) : -1
    const active = edge.source === props.selectedNodeId || (edge.target.chapterId === props.document.id && edge.target.nodeId === props.selectedNodeId)
    return {
      id: edge.id,
      type: 'native-route',
      source: edge.source,
      target: edge.target.chapterId === props.document.id ? edge.target.nodeId : `portal:${edge.target.chapterId}#${edge.target.nodeId}`,
      sourceHandle: edge.choiceId ? `choice:${edge.choiceId}` : 'next',
      markerEnd: { type: MarkerType.ArrowClosed, color: active ? 'var(--agui-c-link)' : 'var(--agui-c-text-2)', width: 16, height: 16 },
      style: { stroke: active ? 'var(--agui-c-link)' : 'var(--agui-c-text-2)', strokeWidth: active ? 2.5 : 1.25, ...(edge.kind === 'implicit' || edge.when ? { strokeDasharray: '5 4' } : {}) },
      data: { ...edge, active, obstacles: obstacles.value, laneIndex, laneCount: siblings.length, badge: choiceIndex >= 0 ? `${choiceIndex + 1}${edge.when ? ' · 条件' : ''}` : '', description: `${edge.source} → ${edge.target.chapterId}#${edge.target.nodeId}${edge.label ? ` · ${edge.label}` : ''}${edge.when ? ` [${edge.when}]` : ''}` },
    }
  })
})
function connect(connection: Connection) {
  if (props.disabled || !connection.source || !connection.target || connection.target.startsWith('portal:'))
    return
  emit('edit', { type: 'connect', nodeId: connection.source, target: connection.target, ...(connection.sourceHandle?.startsWith('choice:') ? { choiceId: connection.sourceHandle.slice(7) } : {}) })
}
function move(event: NodeDragEvent) {
  if (props.disabled || event.node.id.startsWith('portal:'))
    return
  positions.value = new Map(positions.value).set(event.node.id, { ...event.node.position })
  emit('edit', { type: 'move-node', nodeId: event.node.id, position: { ...event.node.position } as FlowEditPosition })
}
function arrange(force = false, persist = false) {
  if (disposed || (persist && props.disabled))
    return
  const input = items.value.map((node) => {
    const measured = flow.findNode(node.id)?.dimensions
    const authored = props.document.nodes.find(item => item.id === node.id)?.position
    return { id: node.id, position: authored ?? positions.value.get(node.id), width: measured?.width || 260, height: measured?.height || 160 }
  })
  positions.value = layoutNativeFlow(input, edges.value, { force })
  if (persist)
    emit('edit', { type: 'arrange-nodes', positions: Object.fromEntries(props.document.nodes.map(node => [node.id, positions.value.get(node.id)!])) })
}
async function focus(zoom = 0.9) {
  const sequence = ++request
  await nextTick()
  if (disposed || sequence !== request || props.visible === false)
    return
  const selected = obstacles.value.find(node => node.id === props.selectedNodeId) ?? obstacles.value[0]
  if (!selected)
    return
  mode.value = 'focus'
  const readableZoom = Math.min(zoom, Math.max(0.75, (flow.dimensions.value.width - 40) / selected.width))
  const visibleHeight = Math.max(100, (flow.dimensions.value.height - 32) / readableZoom)
  await flow.setCenter(selected.x + selected.width / 2, selected.y + Math.min(selected.height, visibleHeight) / 2, { zoom: readableZoom, duration: 0 })
}
async function fit() {
  const sequence = ++request
  await nextTick()
  if (disposed || sequence !== request || props.visible === false)
    return
  mode.value = 'overview'
  await flow.fitView({ padding: 0.15, maxZoom: 1 })
}
function zoomBy(direction: 'in' | 'out') {
  mode.value = 'manual'
  if (direction === 'in')
    void flow.zoomIn()
  else
    void flow.zoomOut()
}
function autoArrange() {
  arrange(true, true)
  void focus()
}
flow.onNodesInitialized(() => {
  arrange()
  void focus()
})
flow.onMoveStart(({ event }) => {
  if (event)
    mode.value = 'manual'
})
watch(() => props.document.id, () => {
  request++
  positions.value = new Map()
  mode.value = 'focus'
}, { flush: 'sync' })
watch(() => JSON.stringify([graph.value.nodes.map(node => [node.id, node.position]), graph.value.edges.map(edge => [edge.source, edge.target])]), async () => {
  await nextTick()
  arrange()
}, { immediate: true })
watch(() => flow.getNodes.value.map(node => `${node.id}:${node.dimensions.width}:${node.dimensions.height}`).join('|'), () => arrange())
watch(() => [props.selectedNodeId, props.visible], () => {
  void focus()
})
watch(() => flow.dimensions.value.width, () => {
  if (mode.value === 'focus')
    void focus()
  else if (mode.value === 'overview')
    void fit()
})
onBeforeUnmount(() => {
  disposed = true
  request++
})
</script>

<template>
  <div class="native-flow-canvas" data-testid="native-flow-canvas" :data-view-mode="mode">
    <div class="native-canvas-toolbar" aria-label="流程图视图操作">
      <AGUIButton :disabled="disabled" title="按实际节点尺寸排列；只保存位置，不改变剧情顺序。可撤销。" data-testid="native-flow-arrange" @click="autoArrange">
        自动排版
      </AGUIButton>
      <AGUIButton title="以可读比例定位选中节点" data-testid="native-flow-focus" @click="focus()">
        定位选中
      </AGUIButton>
      <AGUIButton title="全部节点概览；可放大或定位选中阅读详情" data-testid="native-flow-overview" @click="fit">
        全图概览
      </AGUIButton>
      <AGUIButton title="以 100% 比例显示选中节点" @click="focus(1)">
        100%
      </AGUIButton>
      <div class="native-canvas-controls" role="group" aria-label="缩放">
        <AGUIIconButton icon="i-ri-add-line" title="放大" @click="zoomBy('in')" />
        <AGUIIconButton icon="i-ri-subtract-line" title="缩小" @click="zoomBy('out')" />
      </div>
      <span class="native-zoom">{{ Math.round(flow.viewport.value.zoom * 100) }}%</span>
    </div>
    <div class="native-canvas-viewport">
      <VueFlow :id="flow.id" :nodes="nodes" :edges="edges" :nodes-draggable="!disabled" :nodes-connectable="!disabled" :min-zoom="0.05" :max-zoom="3" @node-click="!$event.node.id.startsWith('portal:') && emit('select', $event.node.id)" @connect="connect" @node-drag-stop="move" @edge-double-click="!disabled && emit('edit', { type: 'disconnect', nodeId: $event.edge.data.source, choiceId: $event.edge.data.choiceId })">
        <Background :gap="20" pattern-color="var(--agui-c-divider)" />
        <template #node-native="slot">
          <NativeFlowNode :data="slot.data" />
        </template>
        <template #edge-native-route="slot">
          <NativeFlowEdge v-bind="slot" />
        </template>
      </VueFlow>
    </div>
    <div class="native-canvas-legend" aria-label="节点类型图例">
      <span data-category="story"><i class="i-ri-chat-1-line" aria-hidden="true" />叙事</span>
      <span data-category="branch"><i class="i-ri-git-branch-line" aria-hidden="true" />分支</span>
      <span data-category="scene"><i class="i-ri-landscape-line" aria-hidden="true" />场景 / 角色</span>
      <span data-category="audio"><i class="i-ri-volume-up-line" aria-hidden="true" />音频</span>
      <span>虚线：顺序 / 条件</span>
    </div>
  </div>
</template>

<style scoped>
.native-flow-canvas {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 300px;
  height: 100%;
  background: var(--agui-c-bg-soft);
}
.native-canvas-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-bottom: 1px solid var(--agui-c-divider);
}
.native-canvas-viewport {
  position: relative;
  flex: 1;
  min-height: 220px;
}
.native-zoom {
  color: var(--agui-c-text-2);
  font-size: 11px;
}
.native-canvas-controls {
  display: flex;
  background: var(--agui-c-bg-panel);
  border: 1px solid var(--agui-c-divider);
}
.native-canvas-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 4px 8px;
  border-top: 1px solid var(--agui-c-divider);
  font-size: 11px;
  color: var(--agui-c-text-2);
}
.native-canvas-legend span {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.native-canvas-legend i {
  width: 12px;
  height: 12px;
}
.native-canvas-legend [data-category='story'] {
  color: var(--agui-flow-story);
}
.native-canvas-legend [data-category='branch'] {
  color: var(--agui-flow-branch);
}
.native-canvas-legend [data-category='scene'] {
  color: var(--agui-flow-scene);
}
.native-canvas-legend [data-category='audio'] {
  color: var(--agui-flow-audio);
}
:deep(.vue-flow__node.selected .native-flow-node) {
  outline: 3px solid var(--agui-c-focus);
  outline-offset: 3px;
}
:deep(.vue-flow__node:hover .native-flow-node) {
  box-shadow: 0 0 0 1px var(--agui-c-text-2);
}
:deep(.vue-flow__node:focus-visible) {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: 6px;
}
</style>
