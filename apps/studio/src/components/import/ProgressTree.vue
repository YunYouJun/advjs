<!--
  Generic step-status tree for any multi-step AI task. Pairs with
  ProgressTreeNode and is the left pane of the Phase M10 import wizard.
  Reusable beyond that context — pass any ProgressTreeNodeView[] and it
  just works.
-->
<script setup lang="ts">
import type { ProgressTreeNodeView } from './ProgressTreeNode.vue'
import ProgressTreeNode from './ProgressTreeNode.vue'

defineProps<{
  nodes: ProgressTreeNodeView[]
  canRetry?: boolean
  title?: string
}>()

defineEmits<{
  retry: [key: string]
}>()
</script>

<template>
  <section class="progress-tree" role="region" :aria-label="title">
    <header v-if="title" class="progress-tree__title">
      {{ title }}
    </header>
    <ul class="progress-tree__list" role="list" aria-live="polite" aria-busy="true">
      <ProgressTreeNode
        v-for="node in nodes"
        :key="node.key"
        :node="node"
        :can-retry="canRetry"
        @retry="$emit('retry', $event)"
      />
    </ul>
  </section>
</template>

<style scoped>
.progress-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--adv-surface-card, var(--ion-background-color));
  border-radius: var(--adv-radius-lg, 12px);
  padding: var(--adv-space-md, 16px);
  border: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
}

.progress-tree__title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-color-medium, #92949c);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--adv-space-sm, 8px);
}

.progress-tree__list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
}
</style>
