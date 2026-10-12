<script setup lang="ts">
import type { FlowEditDocument } from '@advjs/core'
import type { useNativeFlowAuthoring } from '../../../composables/useNativeFlowAuthoring'
import AGUIDetails from '@advjs/gui/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUITextarea from '@advjs/gui/components/textarea/AGUITextarea.vue'
import { ref, watch } from 'vue'
import NativeFlowJsonPreview from './NativeFlowJsonPreview.vue'

const props = defineProps<{ state: ReturnType<typeof useNativeFlowAuthoring> }>()
const emit = defineEmits<{ select: [nodeId: string], selectLine: [nodeId: string, lineId: string] }>()
const text = ref('')
const inputError = ref('')
const preparing = ref(false)
const sourceExpanded = ref(false)
watch(text, () => props.state.dismissProposal())
watch(() => props.state.proposal.value, () => {
  sourceExpanded.value = false
})
watch(() => props.state.path.value, () => {
  text.value = ''
  inputError.value = ''
})
function lineText(document: FlowEditDocument, nodeId: string, lineId: string) {
  const node = document.nodes.find(node => node.id === nodeId)
  const line = node?.lineId === lineId ? node : Array.isArray(node?.dialogues) ? node.dialogues.find(row => row?.lineId === lineId) : undefined
  return typeof line?.text === 'string' ? line.text : '（无）'
}
function toggleSource(event: Event) {
  sourceExpanded.value = (event.currentTarget as HTMLDetailsElement).open
}
async function template() {
  preparing.value = true
  inputError.value = ''
  try {
    text.value = await props.state.proposalTemplate()
  }
  catch (error) { inputError.value = error instanceof Error ? error.message : String(error) }
  finally { preparing.value = false }
}
async function review() {
  inputError.value = ''
  try {
    await props.state.reviewProposal(JSON.parse(text.value))
  }
  catch (error) { inputError.value = error instanceof Error ? error.message : String(error) }
}
</script>

<template>
  <details class="native-proposal" data-testid="native-flow-proposal">
    <summary>AI 修改提案 · 比较后载入草稿</summary>
    <p>粘贴 MCP / CLI 生成的单章节提案 JSON。比较不写入文件；载入后可微调、试玩或撤销，确认后再保存。</p>
    <div class="proposal-actions">
      <AGUIButton :disabled="preparing || state.dirty.value || state.loading.value || state.saving.value" data-testid="native-proposal-template" @click="template">
        当前版本模板
      </AGUIButton>
      <AGUIButton :disabled="preparing || !text || state.dirty.value || state.loading.value || state.saving.value" data-testid="native-proposal-review" @click="review">
        比较与校验
      </AGUIButton>
      <AGUIButton v-if="state.proposal.value" :disabled="state.loading.value || state.saving.value" data-testid="native-proposal-edit" @click="state.dismissProposal">
        修改提案 JSON
      </AGUIButton>
      <AGUIButton v-if="state.proposal.value" :disabled="!state.proposal.value.review || !state.proposal.value.plan.valid || (!state.proposal.value.plan.changes.nodes.length && !state.proposal.value.plan.changes.chapterFields.length) || state.dirty.value || state.loading.value || state.saving.value" data-testid="native-proposal-load" @click="state.loadProposal">
        载入未保存草稿
      </AGUIButton>
    </div>
    <AGUITextarea v-if="!state.proposal.value" v-model="text" :disabled="preparing || state.loading.value || state.saving.value" :rows="5" aria-label="AI 单章节提案 JSON" data-testid="native-proposal-input" placeholder="粘贴包含 path、expectedRevision、projectRevision 与 commands 的提案 JSON" />
    <p v-if="state.dirty.value">
      当前有未保存草稿，请先保存或放弃，再比较另一份提案。
    </p>
    <p v-if="inputError" class="proposal-error" role="alert">
      {{ inputError }}
    </p>
    <div v-if="state.proposal.value" data-testid="native-proposal-review-result">
      <p>{{ state.proposal.value.plan.valid ? '校验通过，尚未写入文件' : '存在错误，不能载入草稿' }} · {{ state.proposal.value.plan.changes.nodes.length }} 个节点变化</p>
      <ul class="proposal-changes">
        <li v-for="node in state.proposal.value.plan.changes.nodes" :key="node.nodeId">
          <AGUIButton :disabled="node.kind === 'added'" @click="emit('select', node.nodeId)">
            定位 {{ node.nodeId }}
          </AGUIButton>
          {{ ({ added: '新增', updated: '修改', deleted: '删除' })[node.kind] }} · {{ node.fields.join('、') }}
        </li>
        <li v-for="line in state.proposal.value.plan.changes.lines" :key="`${line.nodeId}:${line.lineId}`">
          <AGUIButton :disabled="line.kind === 'added'" @click="emit('selectLine', line.nodeId, line.lineId)">
            定位行 {{ line.lineId }}
          </AGUIButton>
          {{ ({ added: '新增', updated: '修改', deleted: '删除' })[line.kind] }} · {{ line.fields.join('、') }}
          <div v-if="line.fields.includes('text') || line.kind !== 'updated'" class="proposal-text-diff" data-testid="native-proposal-line-diff">
            <p><span>当前</span>{{ lineText(state.proposal.value.plan.baseline, line.nodeId, line.lineId) }}</p>
            <p><span>提案</span>{{ lineText(state.proposal.value.plan.proposed, line.nodeId, line.lineId) }}</p>
          </div>
        </li>
        <li v-for="field in state.proposal.value.plan.changes.chapterFields" :key="field">
          章节：{{ field }}
        </li>
      </ul>
      <p v-for="(issue, index) in state.proposal.value.plan.diagnostics" :key="index" :class="{ 'proposal-error': issue.severity === 'error' }">
        {{ issue.code }} · {{ issue.message }}
      </p>
      <AGUIDetails title="查看源文件差异" :open="sourceExpanded" data-testid="native-proposal-source-diff" @toggle="toggleSource">
        <div v-if="sourceExpanded" class="proposal-diff">
          <NativeFlowJsonPreview title="当前版本" :code="state.proposal.value.plan.before" data-testid="native-proposal-before-json" />
          <NativeFlowJsonPreview title="提案版本" :code="state.proposal.value.plan.after" data-testid="native-proposal-after-json" />
        </div>
      </AGUIDetails>
      <AGUIButton @click="state.dismissProposal">
        取消比较
      </AGUIButton>
    </div>
  </details>
</template>

<style scoped>
.native-proposal {
  flex-shrink: 0;
  max-height: 45%;
  overflow: auto;
  padding: 6px 8px;
  border-bottom: 1px solid var(--agui-c-border);
}
.native-proposal summary {
  cursor: pointer;
}
.native-proposal p {
  margin: 6px 0;
}
.proposal-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 6px 0;
}
.proposal-error {
  color: var(--agui-c-danger-text);
}
.proposal-changes {
  padding: 0;
  list-style: none;
}
.proposal-changes li {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 4px 0;
}
.proposal-text-diff {
  flex-basis: 100%;
  min-width: 0;
  padding: 4px 8px;
  background: var(--agui-c-field);
  overflow-wrap: anywhere;
}
.proposal-text-diff p {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 6px;
  margin: 2px 0;
}
.proposal-text-diff span {
  color: var(--agui-c-text-2);
}
.proposal-diff {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
@container (max-width: 640px) {
  .proposal-diff {
    grid-template-columns: 1fr;
  }
}
</style>
