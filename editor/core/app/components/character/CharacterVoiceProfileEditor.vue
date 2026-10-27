<script setup lang="ts">
import type { AdvVoiceCapabilities, CharacterVoiceProfile, VoiceTakeSource } from '@advjs/types'
import { normalizeAudioLocale, validateCharacterVoiceProfile } from '@advjs/audio'
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import { computed } from 'vue'
import CharacterVoiceIntentEditor from './CharacterVoiceIntentEditor.vue'

const props = defineProps<{
  modelValue?: CharacterVoiceProfile
  providers?: Array<{ id: string, capabilities: AdvVoiceCapabilities }>
  idPrefix: string
}>()
const emit = defineEmits<{ 'update:modelValue': [profile: CharacterVoiceProfile | undefined] }>()
const profile = computed(() => props.modelValue ?? { intent: {}, locales: {} })
const bindings = computed(() => Object.entries(profile.value.locales ?? {}).flatMap(([locale, binding]) => Object.entries(binding.providers).map(([providerId, value]) => ({ locale, providerId, ...value }))))
const providerOptions = computed(() => [...new Set([...(props.providers ? props.providers.map(provider => provider.id) : ['qwen-tts', 'openai-tts']), ...bindings.value.map(binding => binding.providerId)])])
const error = computed(() => {
  if (!props.modelValue)
    return ''
  try {
    validateCharacterVoiceProfile(props.modelValue)
    return ''
  }
  catch (cause) {
    return cause instanceof Error ? cause.message : String(cause)
  }
})
function updateIntent(intent: CharacterVoiceProfile['intent']) {
  const next = JSON.parse(JSON.stringify(profile.value)) as CharacterVoiceProfile
  next.intent = intent
  emit('update:modelValue', next)
}
function updateBinding(index: number, field: string, value: string) {
  const next = JSON.parse(JSON.stringify(profile.value)) as CharacterVoiceProfile
  const row = bindings.value[index]!
  const binding = next.locales![row.locale]!.providers[row.providerId]!
  if (field === 'locale' || field === 'providerId') {
    let locale = row.locale
    if (field === 'locale') {
      try {
        locale = normalizeAudioLocale(value)
      }
      catch {
        return
      }
    }
    const providerId = field === 'providerId' ? value : row.providerId
    if (!providerId.trim() || (next.locales?.[locale]?.providers[providerId] && (locale !== row.locale || providerId !== row.providerId)))
      return
    delete next.locales![row.locale]!.providers[row.providerId]
    if (!Object.keys(next.locales![row.locale]!.providers).length)
      delete next.locales![row.locale]
    next.locales![locale] ??= { providers: {} }
    next.locales![locale]!.providers[providerId] = binding
  }
  else if (['license', 'subject', 'consentRecord'].includes(field)) {
    binding.rights ??= { license: '', subject: '', consentRecord: '' }
    Object.assign(binding.rights, { [field]: value })
  }
  else if (field === 'model' && !value.trim()) {
    delete binding.model
  }
  else {
    Object.assign(binding, { [field]: value })
  }
  emit('update:modelValue', next)
}
function addBinding() {
  const next = JSON.parse(JSON.stringify(profile.value)) as CharacterVoiceProfile
  next.locales ??= {}
  const locale = 'zh-CN'
  next.locales[locale] ??= { providers: {} }
  const providerId = providerOptions.value.find(id => !next.locales![locale]!.providers[id])
  if (!providerId)
    return
  next.locales[locale]!.providers[providerId] = { voiceId: '', source: 'system' }
  emit('update:modelValue', next)
}
function removeBinding(index: number) {
  const next = JSON.parse(JSON.stringify(profile.value)) as CharacterVoiceProfile
  const row = bindings.value[index]!
  delete next.locales![row.locale]!.providers[row.providerId]
  if (!Object.keys(next.locales![row.locale]!.providers).length)
    delete next.locales![row.locale]
  emit('update:modelValue', next)
}
function modelNames(providerId: string) {
  return props.providers?.find(provider => provider.id === providerId)?.capabilities.models.map(model => model.id).join(' / ') ?? '与宿主中已审查的预设模型一致'
}
const sourceOptions: VoiceTakeSource[] = ['system', 'designed', 'recorded', 'cloned']
function availableSources(providerId: string, selected: VoiceTakeSource): VoiceTakeSource[] {
  const capabilities = props.providers?.find(provider => provider.id === providerId)?.capabilities
  if (!capabilities)
    return sourceOptions
  const modes = capabilities.models.flatMap(model => model.modes)
  const sources: VoiceTakeSource[] = ['recorded']
  if (modes.some(mode => ['system', 'built-in', 'builtin'].includes(mode)))
    sources.push('system')
  if (modes.some(mode => ['voice-design', 'designed'].includes(mode)))
    sources.push('designed')
  if (modes.some(mode => ['icl', 'embedding-only', 'reference', 'cloned'].includes(mode)))
    sources.push('cloned')
  return selected && !sources.includes(selected) ? [...sources, selected] : sources
}
function capabilityWarning(providerId: string, source: VoiceTakeSource): string {
  if (!props.providers)
    return ''
  const provider = props.providers.find(provider => provider.id === providerId)
  if (!provider)
    return '当前宿主没有此供应商；已保存绑定保留，生成前需要宿主支持。'
  const modes = provider.capabilities.models.flatMap(model => model.modes)
  const allowed = source === 'recorded' || (source === 'system' && modes.some(mode => ['system', 'built-in', 'builtin'].includes(mode))) || (source === 'designed' && modes.some(mode => ['voice-design', 'designed'].includes(mode))) || (source === 'cloned' && modes.some(mode => ['icl', 'embedding-only', 'reference', 'cloned'].includes(mode)))
  return allowed ? '' : '当前宿主未声明这种音色来源的能力；请核对供应商预设。'
}
</script>

<template>
  <AGUIDetails title="配音配置" open>
    <p class="text-xs text-$agui-c-text-2 px-2">
      按语言绑定实际供应商音色和模型；合成预设与授权在宿主中验证。
    </p>
    <CharacterVoiceIntentEditor :model-value="profile.intent" :id-prefix="idPrefix" @update:model-value="updateIntent" />
    <AGUIForm v-for="(binding, index) in bindings" :key="`${binding.locale}/${binding.providerId}`" class="py-2 border-t border-$agui-c-divider" data-testid="character-voice-binding">
      <AGUIProperty :for="`${idPrefix}-voice-locale-${index}`" label="语言">
        <AGUIInput :id="`${idPrefix}-voice-locale-${index}`" :model-value="binding.locale" placeholder="zh-CN" @change="updateBinding(index, 'locale', ($event.target as HTMLInputElement).value)" />
      </AGUIProperty>
      <AGUIProperty :for="`${idPrefix}-voice-provider-${index}`" label="供应商">
        <AGUISelect :id="`${idPrefix}-voice-provider-${index}`" :label="`${binding.locale} 供应商`" :model-value="binding.providerId" :options="providerOptions" @update:model-value="updateBinding(index, 'providerId', String($event))" />
      </AGUIProperty>
      <AGUIProperty :for="`${idPrefix}-voice-id-${index}`" label="实际音色 ID">
        <AGUIInput :id="`${idPrefix}-voice-id-${index}`" :model-value="binding.voiceId" @update:model-value="updateBinding(index, 'voiceId', String($event))" />
      </AGUIProperty>
      <AGUIProperty :for="`${idPrefix}-voice-model-${index}`" label="模型">
        <AGUIInput :id="`${idPrefix}-voice-model-${index}`" :model-value="binding.model ?? ''" :placeholder="modelNames(binding.providerId)" @update:model-value="updateBinding(index, 'model', String($event))" />
      </AGUIProperty>
      <AGUIProperty :for="`${idPrefix}-voice-source-${index}`" label="音色来源">
        <AGUISelect :id="`${idPrefix}-voice-source-${index}`" :label="`${binding.locale} 音色来源`" :model-value="binding.source" :options="availableSources(binding.providerId, binding.source)" @update:model-value="updateBinding(index, 'source', String($event))" />
      </AGUIProperty>
      <p v-if="capabilityWarning(binding.providerId, binding.source)" class="ae-resource-caption px-2" role="status">
        {{ capabilityWarning(binding.providerId, binding.source) }}
      </p>
      <template v-if="binding.source === 'cloned' || binding.rights">
        <AGUIProperty v-for="field in ['license', 'subject', 'consentRecord'] as const" :key="field" :for="`${idPrefix}-voice-${field}-${index}`" :label="({ license: '使用许可', subject: '声音主体', consentRecord: '项目授权文件' })[field]">
          <AGUIInput :id="`${idPrefix}-voice-${field}-${index}`" :model-value="binding.rights?.[field] ?? ''" @update:model-value="updateBinding(index, field, String($event))" />
        </AGUIProperty>
      </template>
      <div class="px-2 flex justify-end">
        <AGUIButton type="button" :aria-label="`移除 ${binding.locale} ${binding.providerId} 配音绑定`" @click="removeBinding(index)">
          移除绑定
        </AGUIButton>
      </div>
    </AGUIForm>
    <p v-if="error" class="ae-resource-error p-2" role="alert">
      {{ error }}
    </p>
    <div class="p-2 flex flex-wrap gap-1">
      <AGUIButton type="button" data-testid="character-voice-add" @click="addBinding">
        添加语言绑定
      </AGUIButton>
      <AGUIButton v-if="modelValue" type="button" data-testid="character-voice-clear" @click="emit('update:modelValue', undefined)">
        清除配音配置
      </AGUIButton>
    </div>
  </AGUIDetails>
</template>
