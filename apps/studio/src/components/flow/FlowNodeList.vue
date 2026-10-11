<script setup lang="ts">
import type { FlowEditDocument, FlowEditEdge } from '@advjs/core'
import { useI18n } from 'vue-i18n'

defineProps<{ document: FlowEditDocument, edges: FlowEditEdge[], selectedId: string }>()
defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <nav class="flow-node-list" :aria-label="t('flowEditor.nodes')">
    <button v-for="(node, index) in document.nodes" :key="node.id" type="button" :aria-current="node.id === selectedId ? 'true' : undefined" @click="$emit('select', node.id)">
      <strong>{{ index + 1 }}. {{ t(`flowEditor.kinds.${node.type ?? 'dialogues'}`) }} <span v-if="(document.startNodeId ?? document.nodes[0]?.id) === node.id">· {{ t('flowEditor.entry') }}</span></strong>
      <code>{{ node.id }}</code>
      <span v-for="edge in edges.filter(edge => edge.source === node.id)" :key="edge.id">→ {{ edge.target.chapterId === document.id ? edge.target.nodeId : `${edge.target.chapterId}#${edge.target.nodeId}` }} · {{ t(`flowEditor.routes.${edge.kind}`) }} {{ edge.label }} {{ edge.when }}</span>
      <span v-if="node.next === null">{{ t('flowEditor.disconnected') }}</span>
    </button>
  </nav>
</template>
