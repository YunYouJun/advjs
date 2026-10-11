<script setup lang="ts">
import type { FlowEditDocument, FlowEditEdge } from '@advjs/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ document: FlowEditDocument, edges: FlowEditEdge[], selectedId: string }>()
defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const nodes = computed(() => props.document.nodes.map((node, index) => ({ ...node, x: node.position?.x ?? 24 + (index % 3) * 250, y: node.position?.y ?? 24 + Math.floor(index / 3) * 150 })))
const bounds = computed(() => {
  const x = Math.min(0, ...nodes.value.map(node => node.x - 24))
  const y = Math.min(0, ...nodes.value.map(node => node.y - 24))
  return { x, y, width: Math.max(800, ...nodes.value.map(node => node.x + 240)) - x, height: Math.max(220, ...nodes.value.map(node => node.y + 120)) - y }
})
function path(edge: FlowEditEdge) {
  const from = nodes.value.find(node => node.id === edge.source)
  const to = edge.target.chapterId === props.document.id ? nodes.value.find(node => node.id === edge.target.nodeId) : undefined
  return from && to ? `M ${from.x + 108} ${from.y + 78} C ${from.x + 108} ${from.y + 110} ${to.x + 108} ${to.y - 30} ${to.x + 108} ${to.y}` : ''
}
</script>

<template>
  <details class="flow-graph" open>
    <summary>{{ t('flowEditor.graph') }}</summary>
    <p>{{ t('flowEditor.graphHint') }}</p>
    <div class="flow-graph__scroll" tabindex="0" :aria-label="t('flowEditor.graph')">
      <svg :viewBox="`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`" :width="bounds.width" :height="bounds.height" role="group">
        <path v-for="edge in edges" :key="edge.id" :d="path(edge)" fill="none" class="flow-graph__edge" :class="{ 'flow-graph__edge--implicit': edge.kind === 'implicit' }"><title>{{ edge.kind }} {{ edge.label }} {{ edge.when }}</title></path>
        <g v-for="node in nodes" :key="node.id" :transform="`translate(${node.x} ${node.y})`" role="button" tabindex="0" :aria-label="`${t(`flowEditor.kinds.${node.type ?? 'dialogues'}`)} ${node.id}`" :aria-pressed="node.id === selectedId" @click="$emit('select', node.id)" @keydown.enter.prevent="$emit('select', node.id)" @keydown.space.prevent="$emit('select', node.id)">
          <rect width="216" height="78" rx="12" :class="{ selected: node.id === selectedId }" />
          <text x="12" y="26">{{ t(`flowEditor.kinds.${node.type ?? 'dialogues'}`) }}</text>
          <text x="12" y="53" class="flow-graph__id">{{ node.id.slice(0, 25) }}</text>
        </g>
      </svg>
    </div>
  </details>
</template>
