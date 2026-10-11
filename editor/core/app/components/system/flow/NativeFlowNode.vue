<script setup lang="ts">
import type { FlowEditNode } from '@advjs/core'
import { isFlowEditRecord } from '@advjs/core'
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps<{ data: { node: FlowEditNode, entry: boolean, portal?: boolean } }>()
const labels: Record<string, string> = { start: '入口', dialogues: '对白', narration: '旁白', choices: '条件选项', background: '场景背景', tachie: '角色演出', audio: '音频', end: '结束' }
const choices = computed(() => Array.isArray(props.data.node.choices) ? props.data.node.choices.filter(isFlowEditRecord) as { id: string, text: string, when?: string }[] : [])
const label = computed(() => {
  const node = props.data.node
  if (Array.isArray(node.dialogues))
    return (node.dialogues.filter(isFlowEditRecord) as { text: string }[]).map(row => row.text).join(' / ')
  return String(node.text ?? node.name ?? node.id)
})
</script>

<template>
  <div class="native-flow-node" :data-native-node="data.node.id" :data-portal="data.portal || undefined">
    <Handle type="target" :position="Position.Left" :connectable="!data.portal" />
    <div class="native-node-kind">
      {{ data.portal ? '跨章目标' : labels[data.node.type ?? 'dialogues'] ?? data.node.type }}{{ data.entry ? ' · 入口' : '' }}
    </div>
    <strong>{{ data.node.id }}</strong>
    <p>{{ label }}</p>
    <div v-for="choice in choices" :key="choice.id" class="native-choice-handle">
      {{ choice.text || choice.id }}<small v-if="choice.when"> · {{ choice.when }}</small>
      <Handle :id="`choice:${choice.id}`" type="source" :position="Position.Right" />
    </div>
    <div v-if="!data.portal && data.node.type !== 'end'" class="native-next-handle">
      {{ data.node.next === null ? '无后继' : data.node.next === undefined ? '顺序后继' : '跳转后继' }}
      <Handle id="next" type="source" :position="Position.Right" />
    </div>
  </div>
</template>

<style scoped>
.native-flow-node {
  width: 210px;
  box-sizing: border-box;
  border: 1px solid var(--agui-c-border);
  border-radius: 2px;
  background: var(--agui-c-bg-panel);
  color: var(--agui-c-text-1);
  padding: 6px;
  font-size: 12px;
}
.native-flow-node[data-portal] {
  border-style: dashed;
}
.native-node-kind,
small {
  color: var(--agui-c-text-2);
  font-size: 11px;
}
strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
p {
  margin: 4px 0;
  max-height: 48px;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.native-next-handle,
.native-choice-handle {
  position: relative;
  padding: 3px 8px 3px 0;
  border-top: 1px solid var(--agui-c-divider);
  overflow-wrap: anywhere;
}
</style>
