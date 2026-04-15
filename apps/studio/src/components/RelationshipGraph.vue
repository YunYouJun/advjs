<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { computed } from 'vue'
import { computeEdgeEndpoints, SVG_SIZE, useCircularLayout } from '../composables/useCircularGraphLayout'
import { getCharacterInitials, getValidAvatarUrl } from '../utils/chatUtils'

const props = defineProps<{
  characters: AdvCharacter[]
}>()

const emit = defineEmits<{
  selectCharacter: [characterId: string]
}>()

const items = computed(() => props.characters)

const { nodes, nodeMap } = useCircularLayout(
  items,
  char => char.id,
  char => char.name || char.id,
  char => ({
    avatar: getValidAvatarUrl(char.avatar),
    initials: getCharacterInitials(char.name),
  }),
)

interface EdgeLayout {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  mx: number
  my: number
  type: string
  description: string
  bidirectional: boolean
}

const edges = computed<EdgeLayout[]>(() => {
  const result: EdgeLayout[] = []
  const seen = new Set<string>()

  for (const char of props.characters) {
    if (!char.relationships)
      continue
    for (const rel of char.relationships) {
      const a = char.id
      const b = rel.targetId
      const fwd = `${a}→${b}`
      const rev = `${b}→${a}`

      if (seen.has(fwd) || seen.has(rev))
        continue

      const nodeA = nodeMap.value.get(a)
      const nodeB = nodeMap.value.get(b)
      if (!nodeA || !nodeB)
        continue

      const isBidirectional = props.characters.some(c =>
        c.id === b && c.relationships?.some(r => r.targetId === a),
      )

      seen.add(fwd)
      seen.add(rev)

      const base = computeEdgeEndpoints(nodeA, nodeB, 24)
      result.push({
        ...base,
        key: fwd,
        type: rel.type,
        description: rel.description || '',
        bidirectional: isBidirectional,
      })
    }
  }

  return result
})

const hasRelationships = computed(() => edges.value.length > 0)

function handleNodeClick(id: string) {
  emit('selectCharacter', id)
}
</script>

<template>
  <div class="relationship-graph">
    <div v-if="!hasRelationships" class="relationship-graph__empty">
      {{ $t('world.noRelationships') }}
    </div>
    <svg
      v-else
      :viewBox="`0 0 ${SVG_SIZE} ${SVG_SIZE}`"
      class="relationship-graph__svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id="arrow-fwd" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" class="graph-arrow" />
        </marker>
        <marker id="arrow-rev" markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto-start-reverse">
          <path d="M0,3 L8,0 L8,6 z" class="graph-arrow" />
        </marker>
      </defs>

      <!-- Edges -->
      <g class="graph-edges">
        <g v-for="edge in edges" :key="edge.key">
          <line
            :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
            class="graph-edge"
            marker-end="url(#arrow-fwd)"
            :marker-start="edge.bidirectional ? 'url(#arrow-rev)' : undefined"
          >
            <title v-if="edge.description">{{ edge.description }}</title>
          </line>
          <text :x="edge.mx" :y="edge.my - 4" class="graph-edge-label" text-anchor="middle">
            {{ edge.type }}
          </text>
        </g>
      </g>

      <!-- Nodes -->
      <g class="graph-nodes">
        <g
          v-for="node in nodes" :key="node.id"
          class="graph-node"
          :transform="`translate(${node.x}, ${node.y})`"
          role="button" tabindex="0"
          @click="handleNodeClick(node.id)"
          @keydown.enter="handleNodeClick(node.id)"
        >
          <circle r="24" class="graph-node-circle" />
          <image
            v-if="node.avatar" :href="node.avatar"
            x="-24" y="-24" width="48" height="48"
            class="graph-node-avatar" clip-path="circle()"
          />
          <text
            v-else class="graph-node-initials"
            text-anchor="middle" dominant-baseline="central"
          >
            {{ node.initials }}
          </text>
          <text y="34" class="graph-node-name" text-anchor="middle">
            {{ node.name }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.relationship-graph {
  width: 100%;
  padding: var(--adv-space-sm) var(--adv-space-md);
}

.relationship-graph__empty {
  text-align: center;
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-tertiary, #94a3b8);
  padding: var(--adv-space-md) 0;
}

.relationship-graph__svg {
  width: 100%;
  max-width: 500px;
  display: block;
  margin: 0 auto;
}

.graph-edge {
  stroke: var(--adv-text-tertiary, #94a3b8);
  stroke-width: 1.5;
  fill: none;
}
.graph-arrow {
  fill: var(--adv-text-tertiary, #94a3b8);
}
.graph-edge-label {
  font-size: 10px;
  fill: var(--adv-text-secondary, #64748b);
  pointer-events: none;
}

.graph-node {
  cursor: pointer;
}
.graph-node-circle {
  fill: var(--adv-surface-elevated, #f1f5f9);
  stroke: var(--adv-primary, #8b5cf6);
  stroke-width: 2;
  transition: fill 0.2s;
}
.graph-node:hover .graph-node-circle {
  fill: var(--adv-primary-light, #ede9fe);
}
:root.dark .graph-node-circle {
  fill: var(--adv-surface-elevated, #2a2a3e);
}
:root.dark .graph-node:hover .graph-node-circle {
  fill: var(--adv-surface-hover, #3a3a4e);
}
.graph-node-avatar {
  pointer-events: none;
}
.graph-node-initials {
  font-size: 14px;
  font-weight: 600;
  fill: var(--adv-primary, #8b5cf6);
  pointer-events: none;
}
.graph-node-name {
  font-size: 11px;
  fill: var(--adv-text-primary, #1e293b);
  pointer-events: none;
}
:root.dark .graph-node-name {
  fill: var(--adv-text-primary, #e2e8f0);
}
:root.dark .graph-edge-label {
  fill: var(--adv-text-secondary, #94a3b8);
}
</style>
