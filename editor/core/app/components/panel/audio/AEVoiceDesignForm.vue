<script setup lang="ts">
import type { VoiceDesignDefinition, VoiceDesignDraft, VoiceDesignSnapshot, VoiceDesignSource } from '@advjs/types'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import { computed, shallowRef, watch } from 'vue'
import CharacterVoiceIntentEditor from '../../character/CharacterVoiceIntentEditor.vue'

const props = defineProps<{ modelValue: VoiceDesignDraft, snapshot: VoiceDesignSnapshot, disabled: boolean, idPrefix: string }>()
const emit = defineEmits<{ 'update:modelValue': [draft: VoiceDesignDraft] }>()
const newLocale = shallowRef('zh-CN')
const newProvider = shallowRef('')
const formError = shallowRef('')
const rows = computed(() => Object.entries(props.modelValue.locales).flatMap(([locale, binding]) => Object.entries(binding.providers).map(([providerId, definition]) => ({ locale, providerId, definition }))))
const providers = computed(() => props.snapshot.providers.filter(provider => provider.presets.length).map(provider => ({ value: provider.id, label: `${provider.id} · ${provider.backend === 'local' ? '本地' : '云端'}` })))
const sourceLabels: Record<VoiceDesignSource, string> = { system: '供应商内置音色', designed: '描述设计', cloned: '授权参考音色' }
const speakerOptions = computed(() => props.snapshot.speakers.map(speaker => ({ value: speaker.id, label: speaker.name })))
watch(providers, (options) => {
  if (!options.some(option => option.value === newProvider.value))
    newProvider.value = options[0]?.value ?? ''
}, { immediate: true })

function change(operation: (draft: VoiceDesignDraft) => void) {
  const draft = JSON.parse(JSON.stringify(props.modelValue)) as VoiceDesignDraft
  operation(draft)
  emit('update:modelValue', draft)
}
function update(field: 'id' | 'version' | 'label' | 'characterId', value: string) {
  change((draft) => {
    draft[field] = value
  })
}
function providerInfo(providerId: string) {
  return props.snapshot.providers.find(provider => provider.id === providerId)
}
function presetOptions(row: typeof rows.value[number]) {
  const presets = providerInfo(row.providerId)?.presets ?? []
  const options = presets.map(preset => ({ value: preset.id, label: `${preset.id} · ${preset.model}` }))
  if (row.definition.preset && !presets.some(preset => preset.id === row.definition.preset))
    options.push({ value: row.definition.preset, label: `${row.definition.preset} · 当前宿主不可用` })
  return options
}
function sources(row: typeof rows.value[number]) {
  const info = providerInfo(row.providerId)
  const allowed = info?.presets.find(preset => preset.id === row.definition.preset)?.sources ?? info?.sources ?? []
  return [...new Set([...allowed, row.definition.source])].map(source => ({ value: source, label: `${sourceLabels[source]}${allowed.includes(source) ? '' : ' · 当前宿主不可用'}` }))
}
function voiceOptions(row: typeof rows.value[number]) {
  const options = providerInfo(row.providerId)?.builtInVoices.map(voice => ({ value: voice.id, label: voice.label })) ?? []
  if (row.definition.providerVoiceId && !options.some(option => option.value === row.definition.providerVoiceId))
    options.push({ value: row.definition.providerVoiceId, label: `${row.definition.providerVoiceId} · 原有绑定` })
  return options
}
function referenceModes(row: typeof rows.value[number]) {
  const modes = providerInfo(row.providerId)?.referenceModes ?? ['icl', 'embedding-only']
  return modes.map(value => ({ value, label: value === 'icl' ? '参考音频与文本' : '仅声音特征' }))
}
function updateDefinition(row: typeof rows.value[number], operation: (definition: VoiceDesignDefinition) => void) {
  change((draft) => {
    operation(draft.locales[row.locale]!.providers[row.providerId]!)
  })
}
function updateSource(row: typeof rows.value[number], source: VoiceDesignSource) {
  updateDefinition(row, (definition) => {
    definition.source = source
    delete definition.description
    delete definition.providerVoiceId
    delete definition.reference
    delete definition.rights
    if (source === 'system') {
      const voice = providerInfo(row.providerId)?.builtInVoices[0]
      if (voice)
        definition.providerVoiceId = voice.id
    }
  })
}
function chooseReference(row: typeof rows.value[number], assetId: string) {
  const asset = props.snapshot.referenceAssets.find(asset => asset.id === assetId)
  if (asset)
    updateDefinition(row, (definition) => { definition.reference = { ...definition.reference, mode: definition.reference?.mode ?? providerInfo(row.providerId)?.referenceModes?.[0] ?? 'icl', assetId: asset.id, sha256: asset.sha256 } })
}
function addBinding() {
  const locale = newLocale.value.trim()
  const provider = providerInfo(newProvider.value)
  const preset = provider?.presets[0]
  if (!locale || !provider || !preset || props.modelValue.locales[locale]?.providers[provider.id]) {
    formError.value = '请选择有效的语言、供应商和预设；相同语言的供应商不能重复。'
    return
  }
  formError.value = ''
  const source = preset.sources[0] ?? provider.sources[0] ?? 'system'
  change((draft) => {
    draft.locales[locale] ??= { providers: {} }
    draft.locales[locale]!.providers[provider.id] = { preset: preset.id, source, ...(source === 'system' && provider.builtInVoices[0] ? { providerVoiceId: provider.builtInVoices[0].id } : {}) }
  })
}
function remove(row: typeof rows.value[number]) {
  change((draft) => {
    delete draft.locales[row.locale]!.providers[row.providerId]
    if (!Object.keys(draft.locales[row.locale]!.providers).length)
      delete draft.locales[row.locale]
  })
}
</script>

<template>
  <AGUIForm class="ae-design-form" :disabled="disabled" as="fieldset">
    <AGUIProperty :for="`${idPrefix}-speaker`" label="角色／旁白">
      <AGUISelect :id="`${idPrefix}-speaker`" label="设计角色／旁白" :model-value="modelValue.characterId" :options="speakerOptions" :disabled="disabled" @update:model-value="update('characterId', String($event))" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-label`" label="音色名称">
      <AGUIInput :id="`${idPrefix}-label`" :model-value="modelValue.label" @update:model-value="update('label', String($event))" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-identity`" label="音色 ID">
      <AGUIInput :id="`${idPrefix}-identity`" :model-value="modelValue.id" @update:model-value="update('id', String($event))" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-version`" label="音色版本">
      <AGUIInput :id="`${idPrefix}-version`" :model-value="modelValue.version" @update:model-value="update('version', String($event))" />
    </AGUIProperty>
    <CharacterVoiceIntentEditor :model-value="modelValue.intent" :id-prefix="idPrefix" @update:model-value="change(draft => { draft.intent = $event })" />
    <AGUIForm v-for="(row, index) in rows" :key="`${row.locale}/${row.providerId}`" class="ae-design-binding" :aria-label="`${row.locale} ${row.providerId} 音色实现`" as="section">
      <p class="ae-design-caption">
        {{ row.locale }} · {{ row.providerId }}
      </p>
      <AGUIProperty :for="`${idPrefix}-preset-${index}`" label="可信预设">
        <AGUISelect :id="`${idPrefix}-preset-${index}`" :label="`${row.locale} ${row.providerId} 可信预设`" :model-value="row.definition.preset" :options="presetOptions(row)" :disabled="disabled" @update:model-value="updateDefinition(row, definition => { definition.preset = String($event) })" />
      </AGUIProperty>
      <AGUIProperty :for="`${idPrefix}-source-${index}`" label="音色来源">
        <AGUISelect :id="`${idPrefix}-source-${index}`" :label="`${row.locale} ${row.providerId} 音色来源`" :model-value="row.definition.source" :options="sources(row)" :disabled="disabled" @update:model-value="updateSource(row, $event as VoiceDesignSource)" />
      </AGUIProperty>
      <AGUIProperty v-if="row.definition.source === 'system'" :for="`${idPrefix}-voice-${index}`" label="内置音色">
        <AGUISelect :id="`${idPrefix}-voice-${index}`" :label="`${row.locale} ${row.providerId} 内置音色`" :model-value="row.definition.providerVoiceId" :options="voiceOptions(row)" :disabled="disabled" @update:model-value="updateDefinition(row, definition => { definition.providerVoiceId = String($event) })" />
      </AGUIProperty>
      <AGUIProperty v-if="row.definition.source === 'designed'" :for="`${idPrefix}-description-${index}`" label="音色描述">
        <textarea :id="`${idPrefix}-description-${index}`" class="agui-textarea ae-design-description" :value="row.definition.description ?? ''" rows="4" @input="updateDefinition(row, definition => { definition.description = ($event.target as HTMLTextAreaElement).value })" />
      </AGUIProperty>
      <template v-if="row.definition.source === 'cloned'">
        <AGUIProperty :for="`${idPrefix}-reference-${index}`" label="已登记参考">
          <AGUISelect :id="`${idPrefix}-reference-${index}`" :label="`${row.locale} ${row.providerId} 已登记参考`" :model-value="row.definition.reference?.assetId" :options="snapshot.referenceAssets.map(asset => ({ value: asset.id, label: asset.title }))" :disabled="disabled" @update:model-value="chooseReference(row, String($event))" />
        </AGUIProperty>
        <AGUIProperty :for="`${idPrefix}-reference-text-${index}`" label="参考文本">
          <AGUIInput :id="`${idPrefix}-reference-text-${index}`" :model-value="row.definition.reference?.text ?? ''" @update:model-value="updateDefinition(row, definition => { if (definition.reference) definition.reference.text = String($event) })" />
        </AGUIProperty>
        <AGUIProperty :for="`${idPrefix}-reference-mode-${index}`" label="参考模式">
          <AGUISelect :id="`${idPrefix}-reference-mode-${index}`" :label="`${row.locale} ${row.providerId} 参考模式`" :model-value="row.definition.reference?.mode ?? 'icl'" :options="referenceModes(row)" :disabled="disabled" @update:model-value="updateDefinition(row, definition => { if (definition.reference) definition.reference.mode = $event as 'icl' | 'embedding-only' })" />
        </AGUIProperty>
        <AGUIProperty v-for="field in ['license', 'subject', 'consentRecord'] as const" :key="field" :for="`${idPrefix}-${field}-${index}`" :label="({ license: '使用许可', subject: '声音主体', consentRecord: '项目同意文件' })[field]">
          <AGUIInput :id="`${idPrefix}-${field}-${index}`" :model-value="row.definition.rights?.[field] ?? ''" @update:model-value="updateDefinition(row, definition => { definition.rights ??= { license: '', subject: '', consentRecord: '' }; definition.rights[field] = String($event) })" />
        </AGUIProperty>
      </template>
      <div class="ae-resource-actions">
        <AGUIButton :disabled="disabled" :aria-label="`移除 ${row.locale} ${row.providerId} 设计绑定`" @click="remove(row)">
          移除设计绑定
        </AGUIButton>
      </div>
    </AGUIForm>
    <AGUIForm v-if="!disabled" class="ae-design-add">
      <AGUIProperty :for="`${idPrefix}-new-locale`" label="新增语言">
        <AGUIInput :id="`${idPrefix}-new-locale`" v-model="newLocale" placeholder="zh-CN" />
      </AGUIProperty>
      <AGUIProperty :for="`${idPrefix}-new-provider`" label="新增供应商">
        <AGUISelect :id="`${idPrefix}-new-provider`" v-model="newProvider" label="新增设计供应商" :options="providers" />
      </AGUIProperty>
      <AGUIButton data-testid="design-add-binding" :disabled="!newProvider" @click="addBinding">
        添加语言／供应商实现
      </AGUIButton>
    </AGUIForm>
    <p v-if="formError" class="ae-resource-error" role="alert">
      {{ formError }}
    </p>
  </AGUIForm>
</template>

<style scoped>
.ae-design-binding,
.ae-design-add {
  border-top: 1px solid var(--agui-c-divider-light);
  padding: var(--agui-space-2) 0;
}
.ae-design-caption {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--agui-c-text-2);
  overflow-wrap: anywhere;
}
.ae-design-description {
  width: 100%;
  min-width: 0;
  resize: vertical;
}
</style>
