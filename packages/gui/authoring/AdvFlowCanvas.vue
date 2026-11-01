<script setup lang="ts" generic="Node extends AuthoringGraphNode">
import type { AuthoringGraph, AuthoringGraphNode } from './types'
import { computed, useId, useTemplateRef } from 'vue'
import { authoringEdgePath } from './canvas-geometry'
import { useAuthoringCanvas } from './use-authoring-canvas'

const props = withDefaults(defineProps<{
  graph: AuthoringGraph & { nodes: readonly Node[] }
  selected: string
  nodeWidth?: number
  nodeHeight?: number
  labels?: { viewport?: string, zoomIn?: string, zoomOut?: string, center?: string, fit?: string, node?: (node: Node) => string }
}>(), { nodeWidth: 236, nodeHeight: 112 })
const emit = defineEmits<{ select: [id: string] }>()
const viewport = useTemplateRef<HTMLElement>('viewport')
const { zoom, x, y, center, scale, fit, wheel, start, move, end } = useAuthoringCanvas(viewport, () => props.graph, () => props.selected, () => ({ width: props.nodeWidth, height: props.nodeHeight }))
const markerId = `adv-flow-arrow-${useId()}`
const nodesById = computed(() => new Map(props.graph.nodes.map(node => [node.id, node])))
const edges = computed(() => props.graph.edges.flatMap((edge, index) => {
  const from = nodesById.value.get(edge.from)
  const to = nodesById.value.get(edge.to)
  return from && to ? [{ ...edge, path: authoringEdgePath(from, to, index, props.nodeWidth, props.nodeHeight) }] : []
}))
</script>

<template>
  <div class="adv-flow-canvas" data-adv-authoring="canvas">
    <div ref="viewport" class="viewport" tabindex="0" :aria-label="labels?.viewport ?? 'Node canvas, drag to pan'" @wheel.prevent="wheel" @pointerdown="start" @pointermove="move" @pointerup="end" @pointercancel="end" @lostpointercapture="end" @keydown.home.prevent="center" @keydown.left.prevent="x += 80" @keydown.right.prevent="x -= 80" @keydown.up.prevent="y += 80" @keydown.down.prevent="y -= 80">
      <div class="graph-plane" :style="{ width: `${graph.width}px`, height: `${graph.height}px`, transform: `translate(${x}px,${y}px) scale(${zoom})` }">
        <svg class="wires" :width="graph.width" :height="graph.height" aria-hidden="true">
          <defs><marker :id="markerId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
          <path v-for="edge in edges" :key="edge.id" :d="edge.path" class="edge" :class="{ active: edge.from === selected || edge.to === selected, conditional: edge.conditional }" :marker-end="`url(#${markerId})`"><title>{{ edge.label }}</title></path>
        </svg>
        <button v-for="node in graph.nodes" :key="node.id" class="story-node" :class="{ selected: node.id === selected }" :style="{ left: `${node.x}px`, top: `${node.y}px`, width: `${nodeWidth}px`, height: `${nodeHeight}px` }" :aria-pressed="node.id === selected" :aria-label="labels?.node?.(node) ?? `${node.id} ${node.title}`" :data-node-id="node.id" @click="emit('select', node.id)">
          <slot name="node" :node="node" :entry="node.id === graph.entry" :selected="node.id === selected">
            <code>{{ node.id }}</code><strong>{{ node.title }}</strong><span>{{ node.text }}</span>
          </slot>
        </button>
      </div>
    </div>
    <slot name="toolbar" :zoom="zoom" :zoom-in="() => scale(1.15)" :zoom-out="() => scale(1 / 1.15)" :center="center" :fit="fit">
      <div class="adv-canvas-toolbar">
        <button :aria-label="labels?.zoomOut ?? 'Zoom out'" @click="scale(1 / 1.15)">
          −
        </button><span>{{ Math.round(zoom * 100) }}%</span><button :aria-label="labels?.zoomIn ?? 'Zoom in'" @click="scale(1.15)">
          +
        </button><button @click="center">
          {{ labels?.center ?? 'Center selection' }}
        </button><button @click="fit">
          {{ labels?.fit ?? 'Fit graph' }}
        </button>
      </div>
    </slot>
  </div>
</template>

<style scoped>
.adv-flow-canvas {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
}
.viewport:active {
  cursor: grabbing;
}
.graph-plane {
  position: absolute;
  transform-origin: 0 0;
  pointer-events: none;
}
.wires {
  position: absolute;
  overflow: visible;
}
.edge {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.edge.conditional {
  stroke-dasharray: 6 5;
}
.story-node {
  position: absolute;
  text-align: left;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.adv-canvas-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
</style>
