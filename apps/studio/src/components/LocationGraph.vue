<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { LocationInfo, SceneInfo } from '../composables/useProjectContent'
import { computed } from 'vue'
import { computeEdgeEndpoints, SVG_SIZE, useCircularLayout } from '../composables/useCircularGraphLayout'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
import { matchLocationByText } from '../utils/locationMatch'

const props = defineProps<{
  locations: LocationInfo[]
  scenes: SceneInfo[]
  characters: AdvCharacter[]
}>()

const emit = defineEmits<{
  selectLocation: [locationId: string]
}>()

const stateStore = useCharacterStateStore()

const locationCharacterMap = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const char of props.characters) {
    const state = stateStore.getState(char.id)
    if (state.location) {
      const matched = matchLocationByText(state.location, props.locations)
      if (matched?.id) {
        if (!map.has(matched.id))
          map.set(matched.id, new Set())
        map.get(matched.id)!.add(char.id)
      }
    }
  }
  for (const loc of props.locations) {
    if (loc.linkedCharacters) {
      if (!map.has(loc.id!))
        map.set(loc.id!, new Set())
      for (const cid of loc.linkedCharacters)
        map.get(loc.id!)!.add(cid)
    }
  }
  return map
})

const locationSceneMap = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const loc of props.locations) {
    if (!loc.id)
      continue
    const scenes = new Set<string>()
    if (loc.linkedScenes) {
      for (const sid of loc.linkedScenes)
        scenes.add(sid)
    }
    for (const scene of props.scenes) {
      if (scene.linkedLocation === loc.id)
        scenes.add(scene.id || scene.name)
    }
    if (scenes.size > 0)
      map.set(loc.id, scenes)
  }
  return map
})

const items = computed(() => props.locations)

const { nodes, nodeMap } = useCircularLayout(
  items,
  loc => loc.id || loc.name,
  loc => loc.name,
  (loc) => {
    const id = loc.id || loc.name
    return {
      type: loc.type || 'other',
      characterCount: locationCharacterMap.value.get(id)?.size || 0,
      sceneCount: locationSceneMap.value.get(id)?.size || 0,
    }
  },
  { smallRadius: 160, largeRadius: 220, threshold: 8 },
)

interface LocationEdge {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  mx: number
  my: number
  sharedCharacters: number
}

const edges = computed<LocationEdge[]>(() => {
  const result: LocationEdge[] = []
  const seen = new Set<string>()
  const locs = props.locations.filter(l => l.id)

  for (let i = 0; i < locs.length; i++) {
    for (let j = i + 1; j < locs.length; j++) {
      const a = locs[i].id!
      const b = locs[j].id!
      const key = `${a}↔${b}`
      if (seen.has(key))
        continue
      seen.add(key)

      const charsA = locationCharacterMap.value.get(a)
      const charsB = locationCharacterMap.value.get(b)
      if (!charsA || !charsB)
        continue

      let shared = 0
      for (const c of charsA) {
        if (charsB.has(c))
          shared++
      }
      if (shared === 0)
        continue

      const nodeA = nodeMap.value.get(a)
      const nodeB = nodeMap.value.get(b)
      if (!nodeA || !nodeB)
        continue

      const base = computeEdgeEndpoints(nodeA, nodeB, 28)
      result.push({ ...base, sharedCharacters: shared })
    }
  }

  return result
})

const TYPE_EMOJI: Record<string, string> = {
  indoor: '🏠',
  outdoor: '🌳',
  virtual: '💻',
  other: '📍',
}

function handleNodeClick(id: string) {
  emit('selectLocation', id)
}
</script>

<template>
  <div class="location-graph">
    <div v-if="locations.length === 0" class="location-graph__empty">
      {{ $t('locations.noLocations') }}
    </div>
    <svg
      v-else
      :viewBox="`0 0 ${SVG_SIZE} ${SVG_SIZE}`"
      class="location-graph__svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Edges -->
      <g class="loc-graph-edges">
        <g v-for="edge in edges" :key="edge.key">
          <line
            :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
            class="loc-graph-edge"
            :stroke-dasharray="edge.sharedCharacters > 1 ? 'none' : '4 3'"
          />
          <text
            v-if="edge.sharedCharacters > 1"
            :x="edge.mx" :y="edge.my - 4"
            class="loc-graph-edge-label" text-anchor="middle"
          >
            {{ edge.sharedCharacters }} {{ $t('locations.sharedChars') }}
          </text>
        </g>
      </g>

      <!-- Nodes -->
      <g class="loc-graph-nodes">
        <g
          v-for="node in nodes" :key="node.id"
          class="loc-graph-node"
          :transform="`translate(${node.x}, ${node.y})`"
          role="button" tabindex="0"
          @click="handleNodeClick(node.id)"
          @keydown.enter="handleNodeClick(node.id)"
        >
          <circle r="28" class="loc-graph-node-circle" />
          <text
            class="loc-graph-node-emoji" text-anchor="middle"
            dominant-baseline="central" font-size="20"
          >
            {{ TYPE_EMOJI[node.type] || '📍' }}
          </text>
          <text y="42" class="loc-graph-node-name" text-anchor="middle">
            {{ node.name }}
          </text>
          <g v-if="node.sceneCount > 0" transform="translate(18, -20)">
            <circle r="8" class="loc-graph-badge loc-graph-badge--scene" />
            <text class="loc-graph-badge-text" text-anchor="middle" dominant-baseline="central">
              {{ node.sceneCount }}
            </text>
          </g>
          <g v-if="node.characterCount > 0" transform="translate(-18, -20)">
            <circle r="8" class="loc-graph-badge loc-graph-badge--char" />
            <text class="loc-graph-badge-text" text-anchor="middle" dominant-baseline="central">
              {{ node.characterCount }}
            </text>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.location-graph {
  width: 100%;
  padding: var(--adv-space-sm) var(--adv-space-md);
}
.location-graph__empty {
  text-align: center;
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-tertiary, #94a3b8);
  padding: var(--adv-space-md) 0;
}
.location-graph__svg {
  width: 100%;
  max-width: 500px;
  display: block;
  margin: 0 auto;
}

.loc-graph-edge {
  stroke: var(--adv-text-tertiary, #94a3b8);
  stroke-width: 1.2;
  fill: none;
}
.loc-graph-edge-label {
  font-size: 9px;
  fill: var(--adv-text-secondary, #64748b);
  pointer-events: none;
}

.loc-graph-node {
  cursor: pointer;
}
.loc-graph-node-circle {
  fill: var(--adv-surface-elevated, #f1f5f9);
  stroke: var(--ion-color-tertiary, #6366f1);
  stroke-width: 2;
  transition: fill 0.2s;
}
.loc-graph-node:hover .loc-graph-node-circle {
  fill: var(--ion-color-tertiary-tint, #e0e7ff);
}
:root.dark .loc-graph-node-circle {
  fill: var(--adv-surface-elevated, #2a2a3e);
}
:root.dark .loc-graph-node:hover .loc-graph-node-circle {
  fill: var(--adv-surface-hover, #3a3a4e);
}
.loc-graph-node-emoji {
  pointer-events: none;
}
.loc-graph-node-name {
  font-size: 11px;
  fill: var(--adv-text-primary, #1e293b);
  pointer-events: none;
}
:root.dark .loc-graph-node-name {
  fill: var(--adv-text-primary, #e2e8f0);
}
:root.dark .loc-graph-edge-label {
  fill: var(--adv-text-secondary, #94a3b8);
}

.loc-graph-badge {
  stroke: white;
  stroke-width: 1.5;
}
.loc-graph-badge--scene {
  fill: var(--ion-color-success, #10b981);
}
.loc-graph-badge--char {
  fill: var(--adv-primary, #8b5cf6);
}
.loc-graph-badge-text {
  font-size: 9px;
  font-weight: 600;
  fill: white;
  pointer-events: none;
}
</style>
