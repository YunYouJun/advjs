<script setup lang="ts">
import type { EdgeProps } from '@vue-flow/core'
import type { NativeFlowObstacle } from '../../../utils/native-flow-routing'
import { BaseEdge, EdgeLabelRenderer } from '@vue-flow/core'
import { computed } from 'vue'
import { routeNativeFlowEdge } from '../../../utils/native-flow-routing'

const props = defineProps<EdgeProps<{ obstacles: NativeFlowObstacle[], laneIndex: number, laneCount: number, badge: string, description: string, active: boolean }>>()
const route = computed(() => routeNativeFlowEdge({ sourceX: props.sourceX, sourceY: props.sourceY, targetX: props.targetX, targetY: props.targetY, sourceId: props.source, targetId: props.target, obstacles: props.data?.obstacles ?? [], laneIndex: props.data?.laneIndex, laneCount: props.data?.laneCount, label: Boolean(props.data?.badge) }))
</script>

<template>
  <g :data-native-edge="id" :data-route-clear="route.obstacleFree">
    <title>{{ data?.description }}</title>
    <BaseEdge :id="id" :path="route.path" :marker-end="markerEnd" :style="style" :interaction-width="20" />
  </g>
  <EdgeLabelRenderer v-if="data?.badge">
    <span class="native-edge-badge nodrag nopan" :data-active="data.active || undefined" :title="data.description" :style="{ transform: `translate(-50%, -50%) translate(${route.label.x}px, ${route.label.y}px)` }">{{ data.badge }}</span>
  </EdgeLabelRenderer>
</template>

<style scoped>
.native-edge-badge {
  position: absolute;
  pointer-events: none;
  padding: 1px 5px;
  border: 1px solid var(--agui-c-control-border);
  border-radius: 3px;
  font-size: 11px;
  line-height: 16px;
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
  white-space: nowrap;
}
.native-edge-badge[data-active] {
  border-color: var(--agui-c-link);
}
</style>
