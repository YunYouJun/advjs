<script setup lang="ts">
import type { ConversationSnapshot } from '../stores/useCharacterChatStore'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  snapshots: ConversationSnapshot[]
  activeSnapshotId?: string
}>()

const emit = defineEmits<{
  restore: [snapshotId: string]
  delete: [snapshotId: string]
}>()

const { t } = useI18n()

interface TreeNode {
  snapshot: ConversationSnapshot
  children: TreeNode[]
  depth: number
}

const tree = computed(() => {
  const snaps = props.snapshots
  if (snaps.length === 0)
    return []

  // Build lookup
  const byId = new Map<string, ConversationSnapshot>()
  for (const s of snaps)
    byId.set(s.id, s)

  // Build parent→children map
  const childrenOf = new Map<string, ConversationSnapshot[]>()
  const roots: ConversationSnapshot[] = []

  for (const s of snaps) {
    if (s.parentSnapshotId && byId.has(s.parentSnapshotId)) {
      const list = childrenOf.get(s.parentSnapshotId) || []
      list.push(s)
      childrenOf.set(s.parentSnapshotId, list)
    }
    else {
      roots.push(s)
    }
  }

  // Sort by createdAt
  roots.sort((a, b) => a.createdAt - b.createdAt)

  // Build tree recursively
  function buildNodes(snaps: ConversationSnapshot[], depth: number): TreeNode[] {
    return snaps
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(s => ({
        snapshot: s,
        depth,
        children: buildNodes(childrenOf.get(s.id) || [], depth + 1),
      }))
  }

  return buildNodes(roots, 0)
})

// Flatten tree for rendering
const flatNodes = computed(() => {
  const result: TreeNode[] = []
  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      result.push(node)
      walk(node.children)
    }
  }
  walk(tree.value)
  return result
})

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="snapshot-tree">
    <div v-if="flatNodes.length === 0" class="snapshot-tree__empty">
      {{ t('world.snapshotTreeEmpty') }}
    </div>
    <div
      v-for="node in flatNodes"
      :key="node.snapshot.id"
      class="snapshot-tree__node"
      :class="{
        'snapshot-tree__node--active': node.snapshot.id === activeSnapshotId,
        'snapshot-tree__node--has-children': node.children.length > 0,
      }"
      :style="{ paddingLeft: `${node.depth * 24 + 12}px` }"
    >
      <!-- Branch connector -->
      <div class="snapshot-tree__connector">
        <div class="snapshot-tree__dot" />
        <div v-if="node.depth > 0" class="snapshot-tree__line" />
      </div>

      <!-- Node content -->
      <div class="snapshot-tree__content">
        <div class="snapshot-tree__header">
          <span class="snapshot-tree__label">{{ node.snapshot.label }}</span>
          <span class="snapshot-tree__meta">
            {{ node.snapshot.messages.length }} {{ t('world.snapshotMessages') }}
          </span>
        </div>
        <div class="snapshot-tree__time">
          {{ formatTime(node.snapshot.createdAt) }}
        </div>
        <div class="snapshot-tree__actions">
          <button class="snapshot-tree__btn snapshot-tree__btn--restore" @click="emit('restore', node.snapshot.id)">
            {{ t('world.snapshotRestore') }}
          </button>
          <button class="snapshot-tree__btn snapshot-tree__btn--delete" @click="emit('delete', node.snapshot.id)">
            &times;
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snapshot-tree {
  padding: var(--adv-space-sm) 0;
}

.snapshot-tree__empty {
  text-align: center;
  padding: var(--adv-space-lg);
  color: var(--adv-text-tertiary, #94a3b8);
  font-size: var(--adv-font-caption, 13px);
}

.snapshot-tree__node {
  display: flex;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-xs, 4px) 0;
  position: relative;
}

.snapshot-tree__connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
  position: relative;
}

.snapshot-tree__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--adv-text-tertiary, #94a3b8);
  border: 2px solid var(--adv-surface, #fff);
  flex-shrink: 0;
  z-index: 1;
}

.snapshot-tree__node--active .snapshot-tree__dot {
  background: var(--adv-primary, #8b5cf6);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
}

.snapshot-tree__line {
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: 100%;
  background: var(--adv-border, #e2e8f0);
  transform: translateX(-50%);
  z-index: 0;
}

.snapshot-tree__content {
  flex: 1;
  min-width: 0;
  padding: var(--adv-space-xs, 4px) var(--adv-space-sm, 8px);
  border-radius: var(--adv-radius-md, 8px);
  background: var(--adv-surface-elevated, #f8fafc);
  border: 1px solid var(--adv-border, #e2e8f0);
  transition: border-color 0.2s;
}

.snapshot-tree__node--active .snapshot-tree__content {
  border-color: var(--adv-primary, #8b5cf6);
  background: rgba(139, 92, 246, 0.04);
}

.snapshot-tree__header {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs, 4px);
}

.snapshot-tree__label {
  font-weight: 600;
  font-size: 13px;
  color: var(--adv-text-primary, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-tree__meta {
  font-size: 11px;
  color: var(--adv-text-tertiary, #94a3b8);
  flex-shrink: 0;
}

.snapshot-tree__time {
  font-size: 11px;
  color: var(--adv-text-tertiary, #94a3b8);
  margin-top: 2px;
}

.snapshot-tree__actions {
  display: flex;
  gap: var(--adv-space-xs, 4px);
  margin-top: var(--adv-space-xs, 4px);
}

.snapshot-tree__btn {
  border: none;
  border-radius: var(--adv-radius-sm, 4px);
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
}

.snapshot-tree__btn--restore {
  background: var(--adv-primary, #8b5cf6);
  color: #fff;
}

.snapshot-tree__btn--restore:hover {
  background: var(--adv-primary-dark, #7c3aed);
}

.snapshot-tree__btn--delete {
  background: transparent;
  color: var(--adv-text-tertiary, #94a3b8);
  font-size: 14px;
  line-height: 1;
}

.snapshot-tree__btn--delete:hover {
  color: var(--ion-color-danger, #ef4444);
}
</style>
