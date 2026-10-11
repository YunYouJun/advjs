<script setup lang="ts">
import type { CharacterVoiceProfile, VoiceTakeSource } from '@advjs/types'
import { normalizeAudioLocale, validateCharacterVoiceProfile } from '@advjs/audio'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'
import SInput from '../ui/SInput.vue'
import SSelect from '../ui/SSelect.vue'

const props = withDefaults(defineProps<{ modelValue?: CharacterVoiceProfile, disabled?: boolean, intentOnly?: boolean }>(), { modelValue: undefined, disabled: false, intentOnly: false })
const emit = defineEmits<{ 'update:modelValue': [value: CharacterVoiceProfile] }>()
const { t } = useI18n()
const error = ref('')
const intent = reactive({ ageImpression: '', genderExpression: '', speakingStyle: '', temperament: '', pitch: '', pace: '' })
const binding = reactive({ locale: '', providerId: '', model: '', voiceId: '', source: '', license: '', subject: '', consentRecord: '' })
const original = ref<{ locale: string, providerId: string }>()
const rows = computed(() => Object.entries(props.modelValue?.locales ?? {}).flatMap(([locale, value]) => Object.entries(value.providers).map(([providerId, config]) => ({ locale, providerId, ...config }))))
watch(() => props.modelValue, (profile) => {
  const value = profile?.intent ?? {}
  Object.assign(intent, { ageImpression: value.ageImpression ?? '', genderExpression: value.genderExpression ?? '', speakingStyle: value.speakingStyle ?? '', temperament: value.temperament?.join(', ') ?? '', pitch: value.pitch ?? '', pace: value.pace ?? '' })
}, { immediate: true })

function publish(value: CharacterVoiceProfile) {
  if (props.disabled)
    return
  try {
    validateCharacterVoiceProfile(value)
    emit('update:modelValue', value)
    error.value = ''
    return true
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('audioProfiles.invalid')
  }
}

function cloneProfile() {
  return JSON.parse(JSON.stringify(props.modelValue ?? { intent: {} })) as CharacterVoiceProfile
}

function applyIntent() {
  const next: CharacterVoiceProfile['intent'] = {}
  for (const key of ['ageImpression', 'genderExpression', 'speakingStyle'] as const) {
    if (intent[key].trim())
      next[key] = intent[key].trim()
  }
  if (intent.temperament.trim())
    next.temperament = intent.temperament.split(',').map(value => value.trim()).filter(Boolean)
  if (intent.pitch)
    next.pitch = intent.pitch as CharacterVoiceProfile['intent']['pitch']
  if (intent.pace)
    next.pace = intent.pace as CharacterVoiceProfile['intent']['pace']
  publish({ ...cloneProfile(), intent: next })
}

function resetBinding() {
  Object.assign(binding, { locale: '', providerId: '', model: '', voiceId: '', source: '', license: '', subject: '', consentRecord: '' })
  original.value = undefined
}

function edit(row: typeof rows.value[number]) {
  original.value = { locale: row.locale, providerId: row.providerId }
  Object.assign(binding, { locale: row.locale, providerId: row.providerId, model: row.model ?? '', voiceId: row.voiceId, source: row.source, license: row.rights?.license ?? '', subject: row.rights?.subject ?? '', consentRecord: row.rights?.consentRecord ?? '' })
}

function remove(profile: CharacterVoiceProfile, locale: string, providerId: string) {
  const local = profile.locales?.[locale]
  if (!local)
    return
  delete local.providers[providerId]
  if (!Object.keys(local.providers).length)
    delete profile.locales![locale]
}

function applyBinding() {
  if (props.disabled)
    return
  try {
    const locale = normalizeAudioLocale(binding.locale)
    const providerId = binding.providerId.trim()
    if (!providerId || !binding.model.trim())
      throw new Error(t('audioProfiles.bindingRequired'))
    const next = cloneProfile()
    if (original.value)
      remove(next, original.value.locale, original.value.providerId)
    next.locales ??= {}
    next.locales[locale] ??= { providers: {} }
    next.locales[locale]!.providers[providerId] = {
      voiceId: binding.voiceId.trim(),
      model: binding.model.trim(),
      source: binding.source as VoiceTakeSource,
      ...(binding.source === 'cloned' || binding.license || binding.subject || binding.consentRecord ? { rights: { license: binding.license.trim(), subject: binding.subject.trim(), consentRecord: binding.consentRecord.trim() } } : {}),
    }
    if (publish(next))
      resetBinding()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('audioProfiles.invalid')
  }
}

function removeBinding(locale: string, providerId: string) {
  const next = cloneProfile()
  remove(next, locale, providerId)
  publish(next)
}
</script>

<template>
  <section class="voice-profile-fields" data-testid="voice-profile-fields">
    <p>{{ t('audioProfiles.hint') }}</p>
    <p v-if="error" class="voice-profile-fields__error" role="alert">
      {{ error }}
    </p>
    <div class="voice-profile-fields__grid">
      <label v-for="field in ['ageImpression', 'genderExpression', 'speakingStyle', 'temperament'] as const" :key="field">
        <span>{{ t(`audioProfiles.${field}`) }}</span>
        <SInput v-model="intent[field]" size="lg" :disabled="disabled" />
      </label>
      <label>
        <span>{{ t('audioProfiles.pitch') }}</span>
        <SSelect v-model="intent.pitch" size="lg" :disabled="disabled" :options="['', 'low', 'medium', 'high'].map(value => ({ value: value || 'unspecified', label: t(`audioProfiles.values.${value || 'unspecified'}`) }))" @update:model-value="intent.pitch = $event === 'unspecified' ? '' : $event" />
      </label>
      <label>
        <span>{{ t('audioProfiles.pace') }}</span>
        <SSelect v-model="intent.pace" size="lg" :disabled="disabled" :options="['', 'slow', 'medium', 'fast'].map(value => ({ value: value || 'unspecified', label: t(`audioProfiles.values.${value || 'unspecified'}`) }))" @update:model-value="intent.pace = $event === 'unspecified' ? '' : $event" />
      </label>
    </div>
    <SButton size="lg" variant="outline" :disabled="disabled" @click="applyIntent">
      {{ t('audioProfiles.applyIntent') }}
    </SButton>
    <template v-if="!intentOnly">
      <ul v-if="rows.length" class="voice-profile-fields__bindings">
        <li v-for="row in rows" :key="`${row.locale}:${row.providerId}`">
          <div>
            <strong>{{ row.locale }} · {{ row.providerId }}</strong>
            <p>{{ row.model }} · {{ row.voiceId }} · {{ t(`audioProfiles.sources.${row.source}`) }}</p>
          </div>
          <div class="voice-profile-fields__actions">
            <SButton size="lg" variant="outline" :disabled="disabled" @click="edit(row)">
              {{ t('audioProfiles.edit') }}
            </SButton>
            <SButton size="lg" variant="ghost" :disabled="disabled" @click="removeBinding(row.locale, row.providerId)">
              {{ t('audioProfiles.remove') }}
            </SButton>
          </div>
        </li>
      </ul>
      <h3>{{ original ? t('audioProfiles.editBinding') : t('audioProfiles.addBinding') }}</h3>
      <div class="voice-profile-fields__grid">
        <label v-for="field in ['locale', 'providerId', 'model', 'voiceId'] as const" :key="field" :data-field="field">
          <span>{{ t(`audioProfiles.${field}`) }}</span>
          <SInput v-model="binding[field]" size="lg" :disabled="disabled" />
        </label>
        <label>
          <span>{{ t('audioProfiles.source') }}</span>
          <SSelect v-model="binding.source" size="lg" :disabled="disabled" :placeholder="t('audioProfiles.selectSource')" :options="['system', 'designed', 'recorded', 'cloned'].map(value => ({ value, label: t(`audioProfiles.sources.${value}`) }))" />
        </label>
        <template v-if="binding.source === 'cloned' || binding.license || binding.subject || binding.consentRecord">
          <label v-for="field in ['license', 'subject', 'consentRecord'] as const" :key="field">
            <span>{{ t(`audioProfiles.${field}`) }}</span>
            <SInput v-model="binding[field]" size="lg" :disabled="disabled" />
          </label>
        </template>
      </div>
      <div class="voice-profile-fields__actions">
        <SButton size="lg" :disabled="disabled" @click="applyBinding">
          {{ t('audioProfiles.applyBinding') }}
        </SButton>
        <SButton v-if="original" size="lg" variant="ghost" :disabled="disabled" @click="resetBinding">
          {{ t('common.cancel') }}
        </SButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.voice-profile-fields {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.voice-profile-fields p {
  margin: 0;
  color: var(--adv-text-secondary);
  line-height: 1.5;
  font-size: var(--adv-font-body-sm);
  overflow-wrap: anywhere;
}
.voice-profile-fields h3 {
  margin: 0;
  font-size: var(--adv-font-body);
}
.voice-profile-fields__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.voice-profile-fields label {
  display: grid;
  gap: 8px;
  min-width: 0;
  font-size: var(--adv-font-body-sm);
}
.voice-profile-fields__bindings {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}
.voice-profile-fields__bindings li {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  overflow-wrap: anywhere;
}
.voice-profile-fields__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.voice-profile-fields .voice-profile-fields__error {
  color: var(--adv-danger);
  overflow-wrap: anywhere;
}
@media (max-width: 420px) {
  .voice-profile-fields__grid {
    grid-template-columns: 1fr;
  }
}
</style>
