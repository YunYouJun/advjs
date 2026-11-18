<script lang="ts" setup>
import type { Edge, Node } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Panel, useVueFlow, VueFlow } from '@vue-flow/core'
import { nextTick, shallowRef, watch } from 'vue'
import { useAdvExtras } from '../../composables/useAdvExtras'
import { useExtrasI18n } from '../../composables/useExtrasI18n'
import { useFlowLayout } from '../../composables/useFlowLayout'

const { t } = useExtrasI18n()
const { route, visibleRoute } = useAdvExtras()
const nodes = shallowRef<Node[]>([])
const edges = shallowRef<Edge[]>([])
const direction = shallowRef<'LR' | 'TB'>('LR')

const { layout } = useFlowLayout()

const { dimensions, fitView, setViewport } = useVueFlow()

// Only reached chapters and anchors are revealed; unvisited routes stay hidden.
watch(visibleRoute, (graph) => {
  nodes.value = (graph?.nodes ?? []).map(node => ({
    id: node.id,
    position: { x: 0, y: 0 },
    class: node.entry ? 'adv-route-node is-entry' : 'adv-route-node',
    data: { label: node.entry && node.title !== node.chapterTitle ? `${node.chapterTitle} · ${node.title}` : node.title },
  }))
  edges.value = (graph?.edges ?? []).map(edge => ({ id: edge.id, source: edge.source, target: edge.target }))
}, { immediate: true })

async function layoutGraph(next: 'LR' | 'TB' = direction.value) {
  direction.value = next
  const placed = layout(nodes.value, edges.value, next)
  nodes.value = placed
  await nextTick()
  const first = placed[0]
  if (!first)
    return
  const { width, height } = dimensions.value
  const horizontal = next === 'LR'
  const axis = horizontal ? 'x' : 'y'
  const available = horizontal ? width : height
  // Fit short routes. Keep long routes readable and start at the first reached node.
  if (placed.every(node => node.position[axis] < available - 192)) {
    await fitView({ maxZoom: 1 })
    return
  }
  await setViewport({
    x: (horizontal ? 32 : Math.max(24, width / 2 - 75)) - first.position.x,
    y: (horizontal ? Math.max(24, height / 2 - 25) : 32) - first.position.y,
    zoom: 1,
  })
}
</script>

<template>
  <div class="layout-flow size-full overflow-hidden">
    <VueFlow :nodes="nodes" :edges="edges" :nodes-connectable="false" @nodes-initialized="layoutGraph()">
      <Background />

      <Panel class="route-summary" position="bottom-left">
        <span v-if="route?.nodes.length">{{ t('route.visited', { count: visibleRoute?.nodes.length ?? 0, total: route.nodes.length }) }}</span>
        <span v-if="route && !visibleRoute?.nodes.length">{{ t('route.empty') }}</span>
      </Panel>

      <Panel class="process-panel" position="bottom-right">
        <div class="layout-panel">
          <button :title="t('route.horizontal')" :aria-label="t('route.horizontal')" @click="layoutGraph('LR')">
            <div class="i-ri-expand-horizontal-s-line" />
          </button>

          <button :title="t('route.vertical')" :aria-label="t('route.vertical')" @click="layoutGraph('TB')">
            <div class="i-ri-expand-vertical-s-line" />
          </button>
        </div>
      </Panel>
    </VueFlow>
  </div>
</template>

<style scoped>
.route-summary {
  border-radius: 8px;
  background-color: rgb(45 55 72 / 90%);
  padding: 8px 12px;
  color: white;
  font-size: 12px;
}

.layout-flow :deep(.adv-route-node.vue-flow__node-default) {
  border-color: #4a5568;
  background-color: #2d3748;
  color: white;
}

.layout-flow :deep(.adv-route-node.is-entry.vue-flow__node-default) {
  border-color: #75ddeb;
  font-weight: 600;
}

.layout-flow {
  background-color: var(--adv-theme-route-background, #1a192b);
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
  font-size: 16px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.process-panel button:hover {
  background-color: #2563eb;
  transition: background-color 0.2s;
}
</style>
