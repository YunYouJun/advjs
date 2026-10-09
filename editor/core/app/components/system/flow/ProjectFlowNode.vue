<script setup lang="ts">
import type { Position } from '@vue-flow/core'
import type { ProjectFlowViewNode } from '../../../utils/project-flow-view'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIIconButton from '@advjs/gui/components/button/AGUIIconButton.vue'
import { Handle } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps<{
  data: ProjectFlowViewNode
  sourcePosition: Position
  targetPosition: Position
  zh: boolean
  busy: boolean
}>()
const emit = defineEmits<{ open: [], expand: [], inspect: [] }>()
const nodeTypes: Record<string, { labels: [string, string], icon: string }> = {
  chapter: { labels: ['章节', 'Chapter'], icon: 'i-ri-book-open-line' },
  section: { labels: ['段落', 'Section'], icon: 'i-ri-paragraph' },
  destinations: { labels: ['目标汇总', 'Destinations'], icon: 'i-ri-git-branch-line' },
  connections: { labels: ['连接汇总', 'Connections'], icon: 'i-ri-git-branch-line' },
  choice: { labels: ['选项', 'Choice'], icon: 'i-ri-checkbox-circle-line' },
  dialog: { labels: ['对白', 'Dialogue'], icon: 'i-ri-chat-1-line' },
  narration: { labels: ['旁白', 'Narration'], icon: 'i-ri-file-text-line' },
  choices: { labels: ['选择', 'Selection'], icon: 'i-ri-git-branch-line' },
  jump: { labels: ['跳转', 'Jump'], icon: 'i-ri-corner-up-right-line' },
  end: { labels: ['结局', 'End'], icon: 'i-ri-flag-line' },
  scene: { labels: ['场景', 'Scene'], icon: 'i-ri-landscape-line' },
  anchor: { labels: ['锚点', 'Anchor'], icon: 'i-ri-anchor-line' },
  effects: { labels: ['演出', 'Effects'], icon: 'i-ri-sparkling-line' },
  actions: { labels: ['动作', 'Actions'], icon: 'i-ri-play-circle-line' },
}
const nodeType = computed(() => {
  if (props.data.overflow)
    return nodeTypes[props.data.overflowKind ?? 'destinations']!
  if (props.data.kind === 'chapter' || props.data.kind === 'section')
    return nodeTypes[props.data.kind]!
  if (props.data.kind === 'choice')
    return nodeTypes.choice!
  const runtimeKind = props.data.runtimeKind ?? ''
  return Object.hasOwn(nodeTypes, runtimeKind) ? nodeTypes[runtimeKind] : undefined
})
const kind = computed(() => nodeType.value?.labels[props.zh ? 0 : 1] ?? props.data.runtimeKind ?? (props.zh ? '剧情' : 'Story'))
const kindIcon = computed(() => nodeType.value?.icon ?? (props.data.runtimeKind ? 'i-ri-puzzle-line' : 'i-ri-file-text-line'))
const nodeLabel = computed(() => props.zh || !props.data.overflow ? props.data.label : props.data.overflowKind === 'connections' ? 'Other connections' : 'Other destinations')
const reachability = computed(() => ({
  reachable: props.zh ? '静态可达' : 'Statically reachable',
  unreachable: props.zh ? '不可达' : 'Unreachable',
  unknown: props.zh ? '可达性未知' : 'Reachability unknown',
})[props.data.reachability])
const sourceLabel = computed(() => props.data.source ? `${props.data.source.path}:${props.data.source.line}` : '')
</script>

<template>
  <div class="project-flow-node" :data-flow-node-id="data.id" :data-flow-kind="data.kind" :data-flow-runtime-kind="data.runtimeKind" :data-flow-reachability="data.reachability" :data-flow-portal="data.portal || undefined">
    <Handle type="target" :position="targetPosition" :connectable="false" />
    <div class="node-meta">
      <span class="node-kind">
        <span class="node-kind-icon" :class="kindIcon" :data-flow-icon="kindIcon" aria-hidden="true" data-testid="flow-node-kind-icon" />
        {{ kind }}{{ data.isEntry ? (zh ? ' · 入口' : ' · Entry') : '' }}
      </span>
      <span v-if="data.diagnostics.length" class="node-diagnostics">{{ data.diagnostics.length }} {{ zh ? '诊断' : 'issues' }}</span>
    </div>
    <AGUIButton
      class="node-source nodrag nopan" variant="text" :disabled="!data.source || busy"
      :aria-label="`${zh ? '定位源码：' : 'Open source: '}${nodeLabel}`"
      :data-flow-source="data.source?.path" :title="sourceLabel" @click="emit('open')"
    >
      {{ nodeLabel }}
    </AGUIButton>
    <div v-if="data.aggregate && !data.overflow" class="node-aggregate">
      <span v-if="data.kind === 'chapter'">{{ data.aggregate.sections }} {{ zh ? '段落' : 'sections' }} · </span>
      {{ data.aggregate.storyNodes }} {{ zh ? '剧情' : 'story nodes' }} · {{ data.aggregate.choices }} {{ zh ? '选项' : 'choices' }}
      <span v-if="data.aggregate.endings"> · {{ data.aggregate.endings }} {{ zh ? '结局' : 'endings' }}</span>
    </div>
    <div class="node-state" :data-state="data.reachability">
      <span v-if="!data.overflow">{{ reachability }}</span>
      <span v-if="data.conditional && !data.overflow">{{ zh ? '有条件' : 'Conditional' }}</span>
      <span v-if="data.overflow">{{ zh ? '展开明细选择准确目标' : 'Open details to choose a destination' }}</span>
      <span v-else-if="data.portal">{{ zh ? '其他区块' : 'Other block' }}</span>
      <AGUIIconButton v-if="data.expandTo" class="node-expand nodrag nopan" icon="i-ri-arrow-right-up-line" :title="`${zh ? '展开：' : 'Expand: '}${nodeLabel}`" :disabled="busy" @click="emit('expand')" />
      <AGUIIconButton v-else-if="data.overflow" class="node-expand nodrag nopan" icon="i-ri-git-branch-line" :title="`${zh ? '查看跳转：' : 'View transitions: '}${nodeLabel}`" :disabled="busy" @click="emit('inspect')" />
    </div>
    <Handle type="source" :position="sourcePosition" :connectable="false" />
  </div>
</template>

<style scoped lang="scss">
.project-flow-node {
  box-sizing: border-box;
  width: 210px;
  padding: 6px;
  border: 1px solid var(--agui-c-border);
  border-radius: 2px;
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
  font-size: 12px;
}
.project-flow-node[data-flow-kind='chapter'] {
  border-color: var(--agui-c-primary);
}
.project-flow-node[data-flow-portal] {
  border-style: dashed;
}
.node-aggregate {
  color: var(--agui-c-text-2);
  line-height: 18px;
}
.node-expand {
  pointer-events: auto;
  margin-left: auto;
}
.node-meta,
.node-state {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  color: var(--agui-c-text-2);
  line-height: 18px;
}
.node-meta {
  justify-content: space-between;
}
.node-kind {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.node-kind-icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: inherit;
}
.node-source {
  // Read-only Vue Flow nodes disable pointer events; source remains actionable.
  pointer-events: auto;
  display: block;
  width: 100%;
  padding: 4px 2px;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  max-height: 70px;
  overflow: auto;
}
.node-state[data-state='unreachable'],
.node-diagnostics {
  color: var(--agui-c-warning-text);
}
</style>
