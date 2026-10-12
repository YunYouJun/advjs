<script setup lang="ts">
import type { FlowEditNode } from '@advjs/core'
import { isFlowEditRecord } from '@advjs/core'
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps<{ data: { node: FlowEditNode, entry: boolean, portal?: boolean, invalid?: boolean } }>()
const kinds: Record<string, { label: string, icon: string, category: string }> = {
  start: { label: '入口', icon: 'i-ri-play-circle-line', category: 'flow' },
  dialogues: { label: '对白', icon: 'i-ri-chat-1-line', category: 'story' },
  narration: { label: '旁白', icon: 'i-ri-file-text-line', category: 'story' },
  choices: { label: '选项', icon: 'i-ri-git-branch-line', category: 'branch' },
  background: { label: '场景背景', icon: 'i-ri-landscape-line', category: 'scene' },
  tachie: { label: '角色演出', icon: 'i-ri-user-line', category: 'scene' },
  audio: { label: '音频', icon: 'i-ri-volume-up-line', category: 'audio' },
  end: { label: '结束', icon: 'i-ri-flag-line', category: 'flow' },
}
const kind = computed(() => props.data.portal
  ? { label: '跨章目标', icon: 'i-ri-arrow-right-up-line', category: 'flow' }
  : kinds[props.data.node.type ?? 'dialogues'] ?? { label: props.data.node.type, icon: 'i-ri-puzzle-line', category: 'flow' })
const choices = computed(() => Array.isArray(props.data.node.choices) ? props.data.node.choices.filter(isFlowEditRecord) as { id: string, text: string, when?: string }[] : [])
const label = computed(() => {
  const node = props.data.node
  if (Array.isArray(node.dialogues))
    return (node.dialogues.filter(isFlowEditRecord) as { text: string }[]).map(row => row.text).join(' / ')
  return String(node.text ?? node.name ?? node.id)
})
</script>

<template>
  <div class="native-flow-node" :data-native-node="data.node.id" :data-category="kind.category" :data-portal="data.portal || undefined" :data-invalid="data.invalid || undefined">
    <Handle type="target" :position="Position.Left" :connectable="!data.portal" />
    <div class="native-node-kind">
      <span class="native-kind-icon" :class="kind.icon" aria-hidden="true" />
      <span>{{ kind.label }}</span>
      <span v-if="data.entry" class="native-entry-badge">入口</span>
      <span v-if="data.invalid" class="native-invalid-badge">目标无效</span>
    </div>
    <strong :title="data.node.id">{{ data.node.id }}</strong>
    <p class="native-node-preview" :title="label">
      {{ label }}
    </p>
    <div v-for="(choice, index) in choices" :key="choice.id" class="native-choice-handle" :title="`${choice.text || choice.id}${choice.when ? ` · ${choice.when}` : ''}`">
      <span class="native-choice-number">{{ index + 1 }}</span>
      <span class="native-choice-text">{{ choice.text || choice.id }}</span>
      <span v-if="choice.when" class="native-condition-badge">条件</span>
      <Handle :id="`choice:${choice.id}`" type="source" :position="Position.Right" />
    </div>
    <div v-if="!data.portal && data.node.type !== 'end'" class="native-next-handle">
      <span>{{ data.node.next === null ? '无后继' : data.node.next === undefined ? '顺序后继' : '跳转后继' }}</span>
      <Handle id="next" type="source" :position="Position.Right" />
    </div>
  </div>
</template>

<style scoped>
.native-flow-node {
  --native-category: var(--agui-flow-neutral);
  width: 260px;
  box-sizing: border-box;
  border: 1px solid var(--agui-c-control-border);
  border-left: 4px solid var(--native-category);
  border-radius: 3px;
  background: var(--agui-c-bg-panel);
  color: var(--agui-c-text-1);
  padding: 8px 10px;
  font-size: 13px;
  line-height: 18px;
}
.native-flow-node[data-category='story'] {
  --native-category: var(--agui-flow-story);
}
.native-flow-node[data-category='branch'] {
  --native-category: var(--agui-flow-branch);
}
.native-flow-node[data-category='scene'] {
  --native-category: var(--agui-flow-scene);
}
.native-flow-node[data-category='audio'] {
  --native-category: var(--agui-flow-audio);
}
.native-flow-node[data-portal] {
  border-style: dashed;
}
.native-flow-node[data-invalid] {
  border-color: var(--agui-c-danger-text);
}
.native-node-kind {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--native-category);
  font-weight: 600;
  margin-bottom: 4px;
}
.native-kind-icon {
  width: 16px;
  height: 16px;
  flex: none;
}
.native-entry-badge,
.native-condition-badge,
.native-invalid-badge {
  font-size: 11px;
  padding: 0 4px;
  border: 1px solid currentColor;
  border-radius: 2px;
  flex: none;
}
.native-entry-badge {
  margin-left: auto;
  color: var(--agui-c-text-2);
}
.native-invalid-badge {
  color: var(--agui-c-danger-text);
}
strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--agui-c-text-2);
}
p {
  margin: 6px 0;
  height: 36px;
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.native-next-handle,
.native-choice-handle {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  border-top: 1px solid var(--agui-c-divider);
}
.native-next-handle {
  color: var(--agui-c-text-2);
  font-size: 11px;
}
.native-choice-number {
  font-weight: 600;
  color: var(--native-category);
  flex: none;
}
.native-choice-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.native-condition-badge {
  margin-left: auto;
  color: var(--agui-c-text-2);
}
/* Rows sit inside 10px padding and a 1px border; ports stay on the card edge. */
:deep(.vue-flow__handle-right) {
  right: -11px;
}
:deep(.vue-flow__handle) {
  width: 9px;
  height: 9px;
  background: var(--native-category);
  border: 2px solid var(--agui-c-bg-panel);
}
</style>
