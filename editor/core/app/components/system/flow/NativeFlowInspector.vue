<script setup lang="ts">
import type { FlowEditCommand, FlowEditDocument, FlowEditNode, ProjectAudioOperation } from '@advjs/core'
import type { AdvAssetManifest } from '@advjs/types'
import { createAudioId } from '@advjs/audio'
import { flowEditReferences, flowEditTargetAddress, isFlowEditRecord } from '@advjs/core'
import AGUIProperty from '@advjs/gui/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIInput from '@advjs/gui/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/components/select/AGUISelect.vue'
import AGUITextarea from '@advjs/gui/components/textarea/AGUITextarea.vue'
import { computed, ref, watch } from 'vue'
import AEAudioOperationEditor from '../../panel/audio/AEAudioOperationEditor.vue'

const props = defineProps<{ document: FlowEditDocument, node: FlowEditNode, catalog?: AdvAssetManifest, otherChapters?: FlowEditDocument[], disabled?: boolean }>()
const emit = defineEmits<{ edit: [command: FlowEditCommand] }>()
const error = ref('')
const nextDraft = ref('')
const extra = ref('{}')
const enter = ref('')
const exit = ref('')
const structured = new Set(['id', 'type', 'lineId', 'next', 'position', 'text', 'dialogues', 'choices', 'sceneId', 'name', 'src', 'action', 'status', 'enter', 'exit', 'operations'])
const extraKeys = computed(() => Object.keys(props.node).filter(key => !structured.has(key)))
const dialogues = computed(() => Array.isArray(props.node.dialogues) ? props.node.dialogues.filter(isFlowEditRecord) as Record<string, unknown>[] : [])
const choices = computed(() => Array.isArray(props.node.choices) ? props.node.choices.filter(isFlowEditRecord) as Record<string, unknown>[] : [])
const invalidRows = computed(() => ['dialogues', 'choices'].some(key => Array.isArray(props.node[key]) && props.node[key].some(row => !isFlowEditRecord(row))))
const references = computed(() => flowEditReferences(props.document, props.node.id, props.otherChapters))
const entry = computed(() => (props.document.startNodeId ?? props.document.nodes[0]?.id) === props.node.id)
const nodeIndex = computed(() => props.document.nodes.indexOf(props.node))
function targetText(value: unknown) {
  if (typeof value === 'string')
    return value
  const target = flowEditTargetAddress(value, props.document.id)
  return target ? `${target.chapterId}#${target.nodeId}` : ''
}
watch(() => props.node, (node) => {
  nextDraft.value = targetText(node.next)
  extra.value = JSON.stringify(Object.fromEntries(extraKeys.value.map(key => [key, node[key]])), null, 2)
  enter.value = node.enter === undefined ? '' : JSON.stringify(node.enter)
  exit.value = node.exit === undefined ? '' : JSON.stringify(node.exit)
  error.value = ''
}, { immediate: true })
function patch(patch: Record<string, unknown>, remove: string[] = []) {
  emit('edit', { type: 'update-node', nodeId: props.node.id, patch, remove })
}
function optional(key: string, value: string) {
  patch(value ? { [key]: value } : {}, value ? [] : [key])
}
function editDialogue(index: number, patch: Record<string, unknown>, remove: string[] = []) {
  emit('edit', { type: 'update-dialogue', nodeId: props.node.id, index, patch, remove })
}
function editChoice(choiceId: string, patch: Record<string, unknown>, remove: string[] = []) {
  emit('edit', { type: 'update-choice', nodeId: props.node.id, choiceId, patch, remove })
}
function changeNext(mode: string) {
  if (mode === 'order')
    patch({}, ['next'])
  else if (mode === 'stop')
    emit('edit', { type: 'disconnect', nodeId: props.node.id })
  else if (nextDraft.value)
    emit('edit', { type: 'connect', nodeId: props.node.id, target: nextDraft.value })
}
function saveExtra() {
  try {
    const value: unknown = JSON.parse(extra.value)
    if (!isFlowEditRecord(value) || Object.keys(value).some(key => structured.has(key)))
      throw new Error('附加字段必须是 JSON 对象，不能覆盖结构化字段或稳定 ID')
    patch(value, extraKeys.value.filter(key => !Object.hasOwn(value, key)))
    error.value = ''
  }
  catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
}
function savePresentation(key: 'enter' | 'exit', value: string) {
  try {
    if (!value) {
      patch({}, [key])
    }
    else {
      const result: unknown = JSON.parse(value)
      if (!(typeof result === 'string' || (Array.isArray(result) && result.every(item => typeof item === 'string'))))
        throw new Error('演出列表使用 JSON 字符串或字符串数组')
      patch({ [key]: result })
    }
  }
  catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
}
function changePosition(axis: 'x' | 'y', value: string) {
  emit('edit', { type: 'move-node', nodeId: props.node.id, position: { x: props.node.position?.x ?? 0, y: props.node.position?.y ?? 0, [axis]: Number(value) } })
}
</script>

<template>
  <aside class="native-flow-inspector" data-testid="native-flow-inspector" aria-label="JSON Flow 节点属性">
    <header><strong>{{ node.type ?? 'dialogues' }}</strong><span>{{ entry ? '章节入口' : '节点属性' }}</span></header>
    <p class="native-id">
      {{ node.id }}
    </p>
    <p v-if="invalidRows" class="native-error" role="alert">
      对白或选项记录格式无效。请打开 JSON 源码修复；原始数据保持完整。
    </p>
    <fieldset :disabled="disabled || invalidRows">
      <div class="native-actions">
        <AGUIButton :disabled="entry" @click="emit('edit', { type: 'set-entry', nodeId: node.id })">
          设为入口
        </AGUIButton>
        <AGUIButton :disabled="references.length > 0" :title="references.length ? '需先修复入口或传入连接' : '删除节点'" data-testid="native-node-delete" @click="emit('edit', { type: 'delete-node', nodeId: node.id })">
          删除节点
        </AGUIButton>
      </div>
      <p v-if="references.length" class="native-caption">
        引用：{{ references.map(ref => `${ref.chapterId}#${ref.nodeId ?? 'entry'} (${ref.kind})`).join('、') }}
      </p>
      <AGUIProperty label="故事顺序">
        <AGUISelect label="故事顺序" :model-value="nodeIndex" :options="document.nodes.map((node, index) => ({ value: index, label: `${index + 1} · ${node.id}` }))" @update:model-value="emit('edit', { type: 'reorder-node', nodeId: node.id, index: Number($event) })" />
      </AGUIProperty>
      <div class="native-position">
        <AGUIProperty label="布局 X">
          <AGUIInput aria-label="布局 X" type="number" :model-value="String(node.position?.x ?? 0)" @change="changePosition('x', ($event.target as HTMLInputElement).value)" />
        </AGUIProperty>
        <AGUIProperty label="布局 Y">
          <AGUIInput aria-label="布局 Y" type="number" :model-value="String(node.position?.y ?? 0)" @change="changePosition('y', ($event.target as HTMLInputElement).value)" />
        </AGUIProperty>
      </div>
      <template v-if="node.type !== 'end'">
        <AGUIProperty label="后继模式">
          <AGUISelect label="后继模式" :model-value="node.next === null ? 'stop' : node.next === undefined ? 'order' : 'target'" :options="[{ value: 'stop', label: '停止后继' }, { value: 'order', label: '按故事顺序' }, { value: 'target', label: '指定跳转' }]" @update:model-value="changeNext(String($event))" />
        </AGUIProperty>
        <AGUIProperty label="跳转目标">
          <AGUIInput v-model="nextDraft" aria-label="跳转目标" placeholder="node 或 chapter#node" />
        </AGUIProperty>
        <div class="native-actions">
          <AGUIButton :disabled="!nextDraft" @click="emit('edit', { type: 'connect', nodeId: node.id, target: nextDraft })">
            连接目标
          </AGUIButton><AGUIButton @click="emit('edit', { type: 'disconnect', nodeId: node.id })">
            断开后继
          </AGUIButton>
        </div>
      </template>
      <template v-if="node.type === 'narration'">
        <p class="native-id">
          {{ node.lineId }}
        </p>
        <AGUITextarea aria-label="旁白文本" :model-value="String(node.text ?? '')" :rows="4" @update:model-value="patch({ text: $event })" />
      </template>
      <template v-if="node.type === 'dialogues' || node.type === undefined">
        <AGUIProperty label="场景 ID">
          <AGUIInput aria-label="场景 ID" :model-value="String(node.sceneId ?? '')" @update:model-value="optional('sceneId', $event)" />
        </AGUIProperty>
        <div v-for="(dialogue, index) in dialogues" :key="String(dialogue.lineId ?? index)" class="native-row">
          <p class="native-id">
            {{ dialogue.lineId ?? '既有对白未登记 lineId' }}
          </p>
          <AGUIProperty label="角色 ID">
            <AGUIInput :aria-label="`对白 ${index + 1} 角色 ID`" :model-value="String(dialogue.speakerId ?? dialogue.speaker ?? 'narrator')" @update:model-value="editDialogue(index, { speakerId: $event }, ['speaker'])" />
          </AGUIProperty>
          <AGUITextarea :aria-label="`对白 ${index + 1} 文本`" :model-value="String(dialogue.text ?? '')" :rows="3" @update:model-value="editDialogue(index, { text: $event })" />
          <AGUIButton @click="emit('edit', { type: 'delete-dialogue', nodeId: node.id, index })">
            删除此句
          </AGUIButton>
        </div>
        <AGUIButton @click="emit('edit', { type: 'add-dialogue', nodeId: node.id, dialogue: { lineId: createAudioId('line'), text: '', speakerId: 'narrator' } })">
          添加对白
        </AGUIButton>
      </template>
      <template v-if="node.type === 'choices'">
        <p class="native-caption">
          条件控制选项可见性；目标可跳转到其他章节。空目标需修复后才能保存。
        </p>
        <div v-for="choice in choices" :key="String(choice.id)" class="native-row">
          <p class="native-id">
            {{ choice.id }}
          </p>
          <AGUIProperty label="选项文本">
            <AGUIInput :aria-label="`选项 ${choice.id} 文本`" :model-value="String(choice.text ?? '')" @update:model-value="editChoice(String(choice.id), { text: $event })" />
          </AGUIProperty>
          <AGUIProperty label="条件表达式">
            <AGUIInput :aria-label="`选项 ${choice.id} 条件`" :model-value="String(choice.when ?? '')" placeholder="ready == true" @update:model-value="editChoice(String(choice.id), $event ? { when: $event } : {}, $event ? [] : ['when'])" />
          </AGUIProperty>
          <AGUIProperty label="目标">
            <AGUIInput :aria-label="`选项 ${choice.id} 目标`" :model-value="targetText(choice.target)" placeholder="chapter#node" @change="($event.target as HTMLInputElement).value ? emit('edit', { type: 'connect', nodeId: node.id, choiceId: String(choice.id), target: ($event.target as HTMLInputElement).value }) : emit('edit', { type: 'disconnect', nodeId: node.id, choiceId: String(choice.id) })" />
          </AGUIProperty>
          <div class="native-actions">
            <AGUIButton @click="emit('edit', { type: 'disconnect', nodeId: node.id, choiceId: String(choice.id) })">
              断开选项
            </AGUIButton><AGUIButton @click="emit('edit', { type: 'delete-choice', nodeId: node.id, choiceId: String(choice.id) })">
              删除选项
            </AGUIButton>
          </div>
        </div>
        <AGUIButton data-testid="native-choice-add" @click="emit('edit', { type: 'add-choice', nodeId: node.id, choice: { id: `choice_${createAudioId('line').slice(5)}`, text: '新选项' } })">
          添加选项
        </AGUIButton>
      </template>
      <template v-if="node.type === 'background' || node.type === 'tachie'">
        <AGUIProperty :label="node.type === 'background' ? '场景 / 背景名' : '角色 ID'">
          <AGUIInput aria-label="演出资源名称" :model-value="String(node.name ?? '')" @update:model-value="patch({ name: $event })" />
        </AGUIProperty>
        <AGUIProperty v-if="node.type === 'background'" label="背景地址">
          <AGUIInput aria-label="背景地址" :model-value="String(node.src ?? '')" @update:model-value="optional('src', $event)" />
        </AGUIProperty>
        <template v-else>
          <AGUIProperty label="动作">
            <AGUISelect label="动作" :model-value="String(node.action ?? 'enter')" :options="[{ value: 'enter', label: '出场' }, { value: 'exit', label: '退场' }]" @update:model-value="patch({ action: $event })" />
          </AGUIProperty>
          <AGUIProperty label="角色状态">
            <AGUIInput aria-label="角色状态" :model-value="String(node.status ?? '')" @update:model-value="optional('status', $event)" />
          </AGUIProperty>
          <AGUIProperty label="出场列表 JSON">
            <AGUIInput v-model="enter" aria-label="出场列表 JSON" placeholder="[&quot;hero&quot;]" @change="savePresentation('enter', enter)" />
          </AGUIProperty>
          <AGUIProperty label="退场列表 JSON">
            <AGUIInput v-model="exit" aria-label="退场列表 JSON" placeholder="[&quot;hero&quot;]" @change="savePresentation('exit', exit)" />
          </AGUIProperty>
        </template>
      </template>
      <AEAudioOperationEditor v-if="node.type === 'audio'" :model-value="(Array.isArray(node.operations) ? node.operations : []) as ProjectAudioOperation[]" :catalog="catalog" :zh="true" :disabled="disabled" @update:model-value="patch({ operations: JSON.parse(JSON.stringify($event)) })" />
      <details class="native-extra">
        <summary>附加作者字段 JSON</summary><p class="native-caption">
          保留原生作者元数据；只应用这里明确修改的附加字段。
        </p><AGUITextarea v-model="extra" aria-label="附加作者字段 JSON" :rows="7" spellcheck="false" /><AGUIButton @click="saveExtra">
          应用附加字段
        </AGUIButton>
      </details>
      <p v-if="error" class="native-error" role="alert">
        {{ error }}
      </p>
    </fieldset>
  </aside>
</template>

<style scoped>
.native-flow-inspector {
  min-width: 0;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  background: var(--agui-c-bg-panel);
  color: var(--agui-c-text-1);
  font-size: 12px;
  padding: 8px;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  display: grid;
  gap: 6px;
}
.native-id,
.native-caption {
  color: var(--agui-c-text-2);
  margin: 4px 0;
  overflow-wrap: anywhere;
  font-size: 11px;
}
.native-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.native-position {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.native-row {
  border: 1px solid var(--agui-c-divider);
  padding: 6px;
  min-width: 0;
  display: grid;
  gap: 6px;
}
.native-error {
  color: var(--agui-c-danger-text);
  overflow-wrap: anywhere;
}
.native-extra summary {
  cursor: pointer;
}
:deep(input),
:deep(textarea) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
:deep(.agui-property) {
  min-width: 0;
}
</style>
