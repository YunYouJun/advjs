<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { computed } from 'vue'
import { getCharacterInitials, getValidAvatarUrl } from '../utils/chatUtils'

const props = defineProps<{
  characters: AdvCharacter[]
}>()

const emit = defineEmits<{
  selectCharacter: [characterId: string]
}>()

const SVG_SIZE = 500
const CX = 250
const CY = 250

const radius = computed(() => props.characters.length <= 10 ? 180 : 240)

interface NodeLayout {
  id: string
  name: string
  avatar: string
  initials: string
  x: number
  y: number
}

const nodes = computed<NodeLayout[]>(() => {
  const n = props.characters.length
  return props.characters.map((char, i) => {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2
    return {
      id: char.id,
      name: char.name || char.id,
      avatar: getValidAvatarUrl(char.avatar),
      initials: getCharacterInitials(char.name),
      x: CX + radius.value * Math.cos(angle),
      y: CY + radius.value * Math.sin(angle),
    }
  })
})

const nodeMap = computed<Map<string, NodeLayout>>(() => {
  const m = new Map<string, NodeLayout>()
  for (const n of nodes.value)
    m.set(n.id, n)
  return m
})

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

      // Offset edge endpoints to node border (radius 24)
      const dx = nodeB.x - nodeA.x
      const dy = nodeB.y - nodeA.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = dx / dist
      const ny = dy / dist
      const r = 24

      result.push({
        key: fwd,
        x1: nodeA.x + nx * r,
        y1: nodeA.y + ny * r,
        x2: nodeB.x - nx * r,
        y2: nodeB.y - ny * r,
        mx: (nodeA.x + nodeB.x) / 2,
        my: (nodeA.y + nodeB.y) / 2,
        type: rel.type,
        description: rel.description || '',
        bidirectional: isBidirectional,
      })
    }
  }

  return result
})

// Only render graph when there are edges
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
        <!-- Forward arrow -->
        <marker
          id="arrow-fwd"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" class="graph-arrow" />
        </marker>
        <!-- Reverse arrow (for bidirectional) -->
        <marker
          id="arrow-rev"
          markerWidth="8"
          markerHeight="8"
          refX="2"
          refY="3"
          orient="auto-start-reverse"
        >
          <path d="M0,3 L8,0 L8,6 z" class="graph-arrow" />
        </marker>
      </defs>

      <!-- Edges -->
      <g class="graph-edges">
        <g v-for="edge in edges" :key="edge.key">
          <line
            :x1="edge.x1"
            :y1="edge.y1"
            :x2="edge.x2"
            :y2="edge.y2"
            class="graph-edge"
            marker-end="url(#arrow-fwd)"
            :marker-start="edge.bidirectional ? 'url(#arrow-rev)' : undefined"
          >
            <title v-if="edge.description">{{ edge.description }}</title>
          </line>
          <!-- Edge label -->
          <text
            :x="edge.mx"
            :y="edge.my - 4"
            class="graph-edge-label"
            text-anchor="middle"
          >
            {{ edge.type }}
          </text>
        </g>
      </g>

      <!-- Nodes -->
      <g class="graph-nodes">
        <g
          v-for="node in nodes"
          :key="node.id"
          class="graph-node"
          :transform="`translate(${node.x}, ${node.y})`"
          role="button"
          tabindex="0"
          @click="handleNodeClick(node.id)"
          @keydown.enter="handleNodeClick(node.id)"
        >
          <circle r="24" class="graph-node-circle" />
          <!-- Avatar image -->
          <image
            v-if="node.avatar"
            :href="node.avatar"
            x="-24"
            y="-24"
            width="48"
            height="48"
            class="graph-node-avatar"
            clip-path="circle()"
          />
          <!-- Initials fallback -->
          <text
            v-else
            class="graph-node-initials"
            text-anchor="middle"
            dominant-baseline="central"
          >
            {{ node.initials }}
          </text>
          <!-- Name label below -->
          <text
            y="34"
            class="graph-node-name"
            text-anchor="middle"
          >
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

/* Edge */
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

/* Node */
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
