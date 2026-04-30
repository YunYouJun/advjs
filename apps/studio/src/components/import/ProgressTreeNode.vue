<!--
  Generic step-status tree for any multi-step AI task. Decoupled from
  `useProjectImport` — accepts plain data and emits `retry` events.

  Reusable across future flows (regenerate-one-chapter, batch image
  generation, etc.) — which is why the shape is an array of nodes rather
  than a projectGenerator-specific type.
-->
<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  ellipseOutline,
  refreshOutline,
} from 'ionicons/icons'
import { computed } from 'vue'

export interface ProgressTreeNodeView {
  key: string
  label: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  message?: string
  children?: Array<{ label: string, status: 'complete' | 'failed' }>
}

const props = defineProps<{
  node: ProgressTreeNodeView
  /** Show the retry button on failed status. */
  canRetry?: boolean
}>()

defineEmits<{
  retry: [key: string]
}>()

const statusIcon = computed(() => {
  switch (props.node.status) {
    case 'complete': return checkmarkCircleOutline
    case 'failed': return alertCircleOutline
    case 'running': return null // rendered as animated dot
    default: return ellipseOutline
  }
})
</script>

<template>
  <li class="progress-node" :data-status="node.status">
    <div class="progress-node__head">
      <span class="progress-node__icon" :aria-hidden="true">
        <span v-if="node.status === 'running'" class="progress-node__dot" />
        <IonIcon v-else-if="statusIcon" :icon="statusIcon" />
      </span>
      <span class="progress-node__label">{{ node.label }}</span>
      <button
        v-if="canRetry && node.status === 'failed'"
        class="progress-node__retry"
        :title="$t('importSource.retryStep')"
        @click="$emit('retry', node.key)"
      >
        <IonIcon :icon="refreshOutline" />
      </button>
    </div>
    <div v-if="node.message" class="progress-node__message">
      {{ node.message }}
    </div>
    <ul v-if="node.children && node.children.length" class="progress-node__children">
      <li
        v-for="(child, idx) in node.children"
        :key="`${node.key}-${idx}`"
        class="progress-node__child"
        :data-status="child.status"
      >
        <IonIcon
          :icon="child.status === 'complete' ? checkmarkCircleOutline : alertCircleOutline"
          class="progress-node__child-icon"
        />
        <span>{{ child.label }}</span>
      </li>
    </ul>
  </li>
</template>

<style scoped>
.progress-node {
  list-style: none;
  padding: var(--adv-space-sm, 8px) 0;
  border-bottom: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
}
.progress-node:last-child {
  border-bottom: none;
}

.progress-node__head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  font-weight: 500;
}

.progress-node__icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: var(--adv-font-subtitle);
}

.progress-node[data-status='complete'] .progress-node__icon {
  color: var(--ion-color-success, #2dd36f);
}
.progress-node[data-status='failed'] .progress-node__icon {
  color: var(--ion-color-danger, #eb445a);
}
.progress-node[data-status='pending'] .progress-node__icon {
  color: var(--ion-color-medium, #92949c);
}
.progress-node[data-status='running'] .progress-node__icon {
  color: var(--ion-color-primary);
}

.progress-node__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  animation: progress-node-pulse 1s ease-in-out infinite;
}
@keyframes progress-node-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.7);
  }
}

.progress-node__label {
  flex: 1;
  color: var(--ion-text-color, inherit);
}

.progress-node__retry {
  background: transparent;
  border: none;
  color: var(--ion-color-primary);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--adv-radius-xs);
  display: inline-flex;
  align-items: center;
}
.progress-node__retry:hover {
  background: rgba(99, 102, 241, 0.1);
}

.progress-node__message {
  margin-left: 28px;
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--ion-color-medium, #92949c);
  line-height: 1.4;
}

.progress-node__children {
  list-style: none;
  margin: 6px 0 0 28px;
  padding: 0;
}

.progress-node__child {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium, #92949c);
  animation: progress-node-child-in 0.3s ease-out;
}

.progress-node__child[data-status='failed'] {
  color: var(--ion-color-danger, #eb445a);
}

.progress-node__child-icon {
  font-size: var(--adv-font-body-sm);
  flex-shrink: 0;
}

@keyframes progress-node-child-in {
  from {
    opacity: 0;
    transform: translateX(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
