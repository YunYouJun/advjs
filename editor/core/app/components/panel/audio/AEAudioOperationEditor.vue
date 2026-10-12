<script setup lang="ts">
import type { ProjectAudioOperation } from '@advjs/core'
import type { AdvAssetManifest } from '@advjs/types'
import { inspectMusicReview, musicPlaybackDefaults } from '@advjs/audio'
import AGUINumberField from '@advjs/gui/components/AGUINumberField.vue'
import AGUIProperty from '@advjs/gui/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIInput from '@advjs/gui/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/components/select/AGUISelect.vue'
import { computed, useId } from 'vue'

const props = defineProps<{ modelValue: ProjectAudioOperation[], catalog?: AdvAssetManifest, zh: boolean, disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: ProjectAudioOperation[]] }>()
const id = useId()
const kinds = computed(() => ['bgm', 'ambience', 'sfx'].map((value, index) => ({ value, label: props.zh ? ['音乐', '环境音', '音效'][index]! : ['Music', 'Ambience', 'SFX'][index]! })))
const slots = computed(() => ['bed', 'weather', 'crowd', 'detail'].map((value, index) => ({ value, label: props.zh ? ['背景', '天气', '人群', '细节'][index]! : value })))
function assets(type: string) {
  return (props.catalog?.assets ?? []).filter(asset => asset.type === 'audio' && asset.kind === type && asset.state !== 'rejected' && (type !== 'bgm' || inspectMusicReview(asset).canBind)).map(asset => ({ value: asset.id, label: asset.title ?? asset.id }))
}
function chooseAsset(index: number, assetId: string) {
  const asset = props.catalog?.assets.find(asset => asset.id === assetId)
  const defaults = asset?.kind === 'bgm' && asset.music ? musicPlaybackDefaults(asset.music.usage) : undefined
  update(index, { asset: assetId, ...(defaults ? { ...defaults, loop: asset?.loop ?? defaults.loop } : {}) })
}
function update(index: number, patch: Partial<ProjectAudioOperation>) {
  const operations = JSON.parse(JSON.stringify(props.modelValue)) as ProjectAudioOperation[]
  operations[index] = { ...operations[index]!, ...patch } as ProjectAudioOperation
  const operation = operations[index]!
  if (operation.action === 'clear') {
    delete operation.asset
    if (operation.fade)
      delete operation.fade.in
  }
  emit('update:modelValue', operations)
}
function changeKind(index: number, type: ProjectAudioOperation['type']) {
  const previous = props.modelValue[index]!
  const { id, gain } = previous
  const operation = { ...(id ? { id } : {}), ...(gain === undefined ? {} : { gain }), type, action: type === 'sfx' ? 'play' : 'set', asset: '', ...(type === 'ambience' ? { slot: 'bed' } : {}) } as ProjectAudioOperation
  // Conditions remain opaque authored data; switching the audio kind preserves them.
  if ('when' in previous)
    Object.assign(operation, { when: previous.when })
  emit('update:modelValue', props.modelValue.map((value, position) => position === index ? operation : value))
}
function add() {
  emit('update:modelValue', [...props.modelValue, { type: 'bgm', action: 'set', asset: '', gain: 1 }])
}
function remove(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, position) => position !== index))
}
</script>

<template>
  <div class="audio-operation-editor" :aria-label="zh ? '场景音频操作' : 'Scene audio operations'">
    <fieldset v-for="(operation, index) in modelValue" :key="index" :disabled="disabled" class="operation-row">
      <legend>{{ zh ? '操作' : 'Operation' }} {{ index + 1 }}</legend>
      <AGUIProperty :for="`${id}-${index}-kind`" :label="zh ? '用途' : 'Kind'">
        <AGUISelect :id="`${id}-${index}-kind`" :label="zh ? '用途' : 'Kind'" :model-value="operation.type" :options="kinds" @update:model-value="changeKind(index, $event as ProjectAudioOperation['type'])" />
      </AGUIProperty>
      <AGUIProperty v-if="operation.type !== 'sfx'" :for="`${id}-${index}-action`" :label="zh ? '动作' : 'Action'">
        <AGUISelect :id="`${id}-${index}-action`" :label="zh ? '动作' : 'Action'" :model-value="operation.action" :options="[{ value: 'set', label: zh ? '播放' : 'Set' }, { value: 'clear', label: zh ? '停止' : 'Clear' }]" @update:model-value="update(index, { action: $event as 'set' | 'clear' })" />
      </AGUIProperty>
      <AGUIProperty v-if="operation.type === 'ambience'" :for="`${id}-${index}-slot`" :label="zh ? '槽位' : 'Slot'">
        <AGUISelect :id="`${id}-${index}-slot`" :label="zh ? '槽位' : 'Slot'" :model-value="operation.slot" :options="slots" @update:model-value="update(index, { slot: $event as 'bed' | 'weather' | 'crowd' | 'detail' })" />
      </AGUIProperty>
      <AGUIProperty v-if="operation.action !== 'clear'" :for="`${id}-${index}-asset`" :label="zh ? '素材' : 'Asset'">
        <AGUISelect :id="`${id}-${index}-asset`" :label="zh ? '素材' : 'Asset'" :model-value="operation.asset ?? ''" :placeholder="zh ? '选择原生素材' : 'Choose native asset'" :options="assets(operation.type)" @update:model-value="chooseAsset(index, $event)" />
      </AGUIProperty>
      <AGUIProperty v-if="operation.action !== 'clear'" :for="`${id}-${index}-gain`" :label="zh ? '音量' : 'Gain'">
        <AGUINumberField :id="`${id}-${index}-gain`" :model-value="operation.gain ?? 1" :min="0" :max="1" :step="0.05" @update:model-value="update(index, { gain: $event })" />
      </AGUIProperty>
      <template v-if="operation.type !== 'sfx'">
        <AGUIProperty v-if="operation.action === 'set'" :for="`${id}-${index}-loop`" :label="zh ? '循环' : 'Loop'">
          <AGUISelect :id="`${id}-${index}-loop`" :label="zh ? '循环' : 'Loop'" :model-value="operation.loop === false ? 'no' : 'yes'" :options="[{ value: 'yes', label: zh ? '开启' : 'On' }, { value: 'no', label: zh ? '关闭' : 'Off' }]" @update:model-value="update(index, { loop: $event === 'yes' })" />
        </AGUIProperty>
        <AGUIProperty v-if="operation.action === 'set'" :for="`${id}-${index}-fade-in`" :label="zh ? '淡入 ms' : 'Fade in ms'">
          <AGUINumberField :id="`${id}-${index}-fade-in`" :model-value="operation.fade?.in ?? 0" :min="0" :max="60000" :step="100" @update:model-value="update(index, { fade: { ...operation.fade, in: $event } })" />
        </AGUIProperty>
        <AGUIProperty :for="`${id}-${index}-fade-out`" :label="zh ? '淡出 ms' : 'Fade out ms'">
          <AGUINumberField :id="`${id}-${index}-fade-out`" :model-value="operation.fade?.out ?? 0" :min="0" :max="60000" :step="100" @update:model-value="update(index, { fade: { ...operation.fade, out: $event } })" />
        </AGUIProperty>
      </template>
      <template v-else>
        <AGUIProperty :for="`${id}-${index}-group`" :label="zh ? '并发组' : 'Group'">
          <AGUIInput :id="`${id}-${index}-group`" :model-value="operation.group ?? ''" @update:model-value="update(index, { group: $event || undefined })" />
        </AGUIProperty>
        <AGUIProperty :for="`${id}-${index}-priority`" :label="zh ? '优先级' : 'Priority'">
          <AGUINumberField :id="`${id}-${index}-priority`" :model-value="operation.priority ?? 0" :step="1" @update:model-value="update(index, { priority: $event })" />
        </AGUIProperty>
      </template>
      <AGUIButton :disabled="disabled" @click="remove(index)">
        {{ zh ? '移除此操作' : 'Remove operation' }}
      </AGUIButton>
    </fieldset>
    <AGUIButton :disabled="disabled || modelValue.length >= 64" data-testid="audio-operation-add" @click="add">
      {{ zh ? '添加音频操作' : 'Add audio operation' }}
    </AGUIButton>
  </div>
</template>

<style scoped>
.audio-operation-editor {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.operation-row {
  min-width: 0;
  margin: 0;
  padding: 6px;
  border: 1px solid var(--agui-c-divider);
}
.operation-row legend {
  font-size: 12px;
  color: var(--agui-c-text-2);
}
</style>
