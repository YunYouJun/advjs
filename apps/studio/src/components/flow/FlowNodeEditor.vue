<script setup lang="ts">
import type { FlowEditCommand, FlowEditNode } from '@advjs/core'
import type { AdvAssetEntry } from '@advjs/types'
import { createAudioId } from '@advjs/audio'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'
import FlowAudioFields from './FlowAudioFields.vue'

const props = defineProps<{ node: FlowEditNode, index: number, busy: boolean, assets: AdvAssetEntry[] }>()
const emit = defineEmits<{ command: [command: FlowEditCommand] }>()
const { t } = useI18n()
const kind = computed(() => props.node.type ?? (Array.isArray(props.node.dialogues) ? 'dialogues' : undefined))
const rows = computed(() => Array.isArray(props.node.dialogues) ? props.node.dialogues as Array<Record<string, unknown>> : [])
const choices = computed(() => Array.isArray(props.node.choices) ? props.node.choices as Array<Record<string, unknown>> : [])
const target = (value: unknown) => typeof value === 'string' ? value : value && typeof value === 'object' && 'chapterId' in value && 'nodeId' in value ? `${value.chapterId}#${value.nodeId}` : ''
const input = (event: Event) => (event.target as HTMLInputElement).value
function patch(key: string, value: unknown) {
  emit('command', { type: 'update-node', nodeId: props.node.id, patch: { [key]: value } })
}
function move(axis: 'x' | 'y', event: Event) {
  emit('command', { type: 'move-node', nodeId: props.node.id, position: { x: props.node.position?.x ?? 0, y: props.node.position?.y ?? 0, [axis]: Number(input(event)) } })
}
function updateRow(index: number, key: string, event: Event) {
  const value = input(event)
  emit('command', { type: 'update-dialogue', nodeId: props.node.id, index, patch: key === 'speakerId' && !value ? {} : { [key]: value }, ...(key === 'speakerId' ? { remove: value ? ['speaker'] : ['speaker', 'speakerId'] } : {}) })
}
function optional(key: string, value: unknown) {
  emit('command', { type: 'update-node', nodeId: props.node.id, patch: value === '' ? {} : { [key]: value }, ...(value === '' ? { remove: [key] } : {}) })
}
function aliases(key: 'enter' | 'exit', event: Event) {
  const field = event.target as HTMLTextAreaElement
  try {
    field.setCustomValidity('')
    if (!field.value.trim()) {
      optional(key, '')
      return
    }
    const value: unknown = JSON.parse(field.value)
    if (typeof value !== 'string' && !(Array.isArray(value) && value.every(item => typeof item === 'string')))
      throw new Error('Invalid aliases')
    optional(key, value)
  }
  catch {
    field.setCustomValidity(t('flowEditor.aliasesHint'))
    field.reportValidity()
  }
}
function updateChoice(choiceId: string, key: string, event: Event) {
  const value = input(event)
  emit('command', { type: 'update-choice', nodeId: props.node.id, choiceId, patch: value ? { [key]: value } : {}, ...(!value ? { remove: [key] } : {}) })
}
function operations(event: Event) {
  const field = event.target as HTMLTextAreaElement
  try {
    field.setCustomValidity('')
    patch('operations', JSON.parse(input(event)))
  }
  catch {
    field.setCustomValidity(t('flowEditor.invalidJson'))
    field.reportValidity()
  }
}
</script>

<template>
  <section class="flow-node-editor" data-testid="flow-node-editor">
    <h3>{{ t(`flowEditor.kinds.${kind}`) }}</h3>
    <code>{{ node.id }}</code>
    <p>{{ t('flowEditor.stableIdHint') }}</p>
    <div class="flow-fields">
      <label>{{ t('flowEditor.order') }}<input type="number" :value="index + 1" min="1" :disabled="busy" @change="emit('command', { type: 'reorder-node', nodeId: node.id, index: Number(input($event)) - 1 })"></label>
      <label v-for="axis in ['x', 'y'] as const" :key="axis">{{ t('flowEditor.position') }} {{ axis.toUpperCase() }}<input type="number" :value="node.position?.[axis] ?? 0" :disabled="busy" @change="move(axis, $event)"></label>
    </div>
    <div class="flow-actions">
      <SButton size="lg" variant="outline" :disabled="busy" @click="emit('command', { type: 'set-entry', nodeId: node.id })">
        {{ t('flowEditor.setEntry') }}
      </SButton>
      <SButton size="lg" variant="danger" :disabled="busy" @click="emit('command', { type: 'delete-node', nodeId: node.id })">
        {{ t('flowEditor.deleteNode') }}
      </SButton>
    </div>
    <template v-if="node.type !== 'end'">
      <label>{{ t('flowEditor.next') }}<input :value="target(node.next)" :disabled="busy" :placeholder="t('flowEditor.targetHint')" @change="input($event) && emit('command', { type: 'connect', nodeId: node.id, target: input($event) })"></label>
      <div class="flow-actions">
        <SButton size="lg" variant="outline" :disabled="busy" @click="emit('command', { type: 'disconnect', nodeId: node.id })">
          {{ t('flowEditor.disconnect') }}
        </SButton>
        <SButton size="lg" variant="ghost" :disabled="busy" @click="emit('command', { type: 'update-node', nodeId: node.id, patch: {}, remove: ['next'] })">
          {{ t('flowEditor.useImplicit') }}
        </SButton>
      </div>
    </template>
    <template v-if="kind === 'dialogues'">
      <label>{{ t('flowEditor.scene') }}<input :value="node.sceneId" :disabled="busy" @change="optional('sceneId', input($event))"></label>
      <fieldset v-for="(row, rowIndex) in rows" :key="String(row.lineId ?? rowIndex)">
        <legend>{{ t('flowEditor.dialogue') }} {{ rowIndex + 1 }}</legend><code>{{ row.lineId }}</code>
        <label>{{ t('flowEditor.speaker') }}<input :value="row.speakerId ?? row.speaker ?? ''" :disabled="busy" @change="updateRow(rowIndex, 'speakerId', $event)"></label>
        <label>{{ t('flowEditor.text') }}<textarea :value="String(row.text ?? '')" :disabled="busy" @change="updateRow(rowIndex, 'text', $event)" /></label>
        <SButton size="lg" variant="ghost" :disabled="busy" @click="emit('command', { type: 'delete-dialogue', nodeId: node.id, index: rowIndex })">
          {{ t('flowEditor.deleteDialogue') }}
        </SButton>
      </fieldset>
      <SButton size="lg" variant="outline" :disabled="busy" @click="emit('command', { type: 'add-dialogue', nodeId: node.id, dialogue: { lineId: createAudioId('line'), speakerId: 'narrator', text: '' } })">
        {{ t('flowEditor.addDialogue') }}
      </SButton>
    </template>
    <template v-if="node.type === 'narration'">
      <code>{{ node.lineId }}</code><label>{{ t('flowEditor.text') }}<textarea :value="String(node.text ?? '')" :disabled="busy" @change="patch('text', input($event))" /></label>
    </template>
    <template v-if="node.type === 'choices'">
      <p>{{ t('flowEditor.branchHint') }}</p>
      <fieldset v-for="choice in choices" :key="String(choice.id)">
        <legend>{{ choice.id }}</legend>
        <label v-for="field in ['text', 'when', 'target']" :key="field">{{ t(`flowEditor.${field}`) }}<input :value="field === 'target' ? target(choice.target) : choice[field]" :disabled="busy" :placeholder="field === 'target' ? t('flowEditor.targetHint') : undefined" @change="updateChoice(String(choice.id), field, $event)"></label>
        <div class="flow-actions">
          <SButton size="lg" variant="outline" :disabled="busy" @click="emit('command', { type: 'disconnect', nodeId: node.id, choiceId: String(choice.id) })">
            {{ t('flowEditor.disconnect') }}
          </SButton>
          <SButton size="lg" variant="ghost" :disabled="busy" @click="emit('command', { type: 'delete-choice', nodeId: node.id, choiceId: String(choice.id) })">
            {{ t('flowEditor.deleteChoice') }}
          </SButton>
        </div>
      </fieldset>
      <SButton size="lg" variant="outline" :disabled="busy" @click="emit('command', { type: 'add-choice', nodeId: node.id, choice: { id: `choice_${createAudioId('line').slice(5)}`, text: '' } })">
        {{ t('flowEditor.addChoice') }}
      </SButton>
    </template>
    <template v-if="node.type === 'background' || node.type === 'tachie'">
      <label>{{ t(node.type === 'background' ? 'flowEditor.scene' : 'flowEditor.character') }}<input :value="node.name" :disabled="busy" @change="patch('name', input($event))"></label>
      <label v-if="node.type === 'background'">{{ t('flowEditor.backgroundSource') }}<input :value="node.src" :disabled="busy" @change="optional('src', input($event))"></label>
      <template v-if="node.type === 'tachie'">
        <label>{{ t('flowEditor.action') }}<select :value="node.action" :disabled="busy" @change="patch('action', input($event))"><option v-for="action in ['enter', 'exit']" :key="action" :value="action">{{ action }}</option></select></label>
        <label>{{ t('flowEditor.status') }}<input :value="node.status" :disabled="busy" @change="patch('status', input($event))"></label>
        <p>{{ t('flowEditor.aliasesHint') }}</p>
        <label v-for="field in ['enter', 'exit'] as const" :key="field">{{ t(`flowEditor.${field}Aliases`) }}<textarea :value="node[field] === undefined ? '' : JSON.stringify(node[field], null, 2)" :disabled="busy" spellcheck="false" @change="aliases(field, $event)" /></label>
      </template>
    </template>
    <template v-if="node.type === 'audio'">
      <FlowAudioFields :operations="node.operations" :assets="assets" :busy="busy" @update="patch('operations', $event)" />
      <details><summary>{{ t('flowEditor.advancedJson') }}</summary><label>{{ t('flowEditor.operations') }}<textarea :value="JSON.stringify(node.operations ?? [], null, 2)" :disabled="busy" spellcheck="false" @change="operations" /></label></details>
    </template>
  </section>
</template>
