<script setup lang="ts">
import type { AudioPronunciationDictionary, AudioVoiceProfiles, CharacterVoiceProfile } from '@advjs/types'
import { createAudioPronunciationDictionary, createAudioVoiceProfiles, normalizeAudioLocale, parseAudioPronunciationDictionary, resolveVoiceSpokenText } from '@advjs/audio'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectContent } from '../../composables/useProjectContent'
import { useStudioStore } from '../../stores/useStudioStore'
import { createStudioAudioService } from '../../utils/projectAudio'
import SButton from '../ui/SButton.vue'
import SInput from '../ui/SInput.vue'
import VoiceProfileFields from './VoiceProfileFields.vue'

const props = defineProps<{ active: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const project = useProjectContent()
const studio = useStudioStore()
const narrator = shallowRef<CharacterVoiceProfile>()
const profiles = shallowRef<AudioVoiceProfiles>(createAudioVoiceProfiles())
const dictionary = shallowRef<AudioPronunciationDictionary>(createAudioPronunciationDictionary())
const rows = ref<Array<{ locale: string, text: string, replacement: string }>>([])
const revision = shallowRef('')
const error = shallowRef('')
const busy = shallowRef(false)
const loaded = shallowRef(false)
const sample = ref('')
const sampleLocale = ref('')
let epoch = 0

function proposedDictionary() {
  const grouped = new Map<string, Map<string, string>>()
  for (const row of rows.value) {
    const locale = row.locale.trim() ? normalizeAudioLocale(row.locale) : ''
    const entries = grouped.get(locale) ?? new Map<string, string>()
    if (entries.has(row.text))
      throw new Error(t('audioProfiles.duplicateWord'))
    entries.set(row.text, row.replacement)
    grouped.set(locale, entries)
  }
  return parseAudioPronunciationDictionary({
    schemaVersion: 1,
    revision: dictionary.value.revision,
    replacements: Object.fromEntries(grouped.get('') ?? []),
    locales: Object.fromEntries([...grouped].filter(([locale]) => locale).map(([locale, entries]) => [locale, { replacements: Object.fromEntries(entries) }])),
  })
}

const spokenSample = computed(() => {
  try {
    return sample.value ? resolveVoiceSpokenText(sample.value, { locale: sampleLocale.value || 'und', pronunciation: proposedDictionary() }) : ''
  }
  catch { return '' }
})

async function reload() {
  const request = ++epoch
  loaded.value = false
  busy.value = false
  error.value = ''
  if (!props.active)
    return
  try {
    await project.whenReady()
    const fs = project.getFs()
    if (!fs)
      throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
    const snapshot = await createStudioAudioService(fs).read()
    if (request !== epoch || !props.active || fs !== project.getFs())
      return
    profiles.value = snapshot.voiceProfiles ?? createAudioVoiceProfiles()
    dictionary.value = snapshot.pronunciation ?? createAudioPronunciationDictionary()
    narrator.value = snapshot.narratorProfile
    revision.value = snapshot.revision
    rows.value = [
      ...Object.entries(dictionary.value.replacements).map(([text, replacement]) => ({ locale: '', text, replacement })),
      ...Object.entries(dictionary.value.locales).flatMap(([locale, value]) => Object.entries(value.replacements).map(([text, replacement]) => ({ locale, text, replacement }))),
    ]
    loaded.value = true
  }
  catch (cause) {
    if (request === epoch)
      error.value = cause instanceof Error ? cause.message.split(':')[0]! : 'AUDIO_JOB_OPERATION_FAILED'
  }
}

async function save(kind: 'narrator' | 'dictionary') {
  if (busy.value || !loaded.value)
    return
  const fs = project.getFs()
  if (!fs)
    return
  const request = epoch
  const service = createStudioAudioService(fs)
  busy.value = true
  error.value = ''
  try {
    if (kind === 'narrator')
      await service.saveVoiceProfiles({ expectedRevision: revision.value, profiles: { schemaVersion: 1, revision: profiles.value.revision, ...(narrator.value ? { narrator: narrator.value } : {}) } })
    else
      await service.savePronunciation({ expectedRevision: revision.value, dictionary: proposedDictionary() })
    if (request === epoch && props.active && fs === project.getFs()) {
      emit('changed')
      await reload()
    }
  }
  catch (cause) {
    if (request === epoch)
      error.value = cause instanceof Error ? cause.message : 'AUDIO_JOB_OPERATION_FAILED'
  }
  finally {
    if (request === epoch)
      busy.value = false
  }
}
watch([() => props.active, () => studio.currentProjectId], () => void reload(), { immediate: true })
onScopeDispose(() => epoch++)
</script>

<template>
  <section class="voice-configuration" :aria-busy="busy">
    <p v-if="error" class="voice-configuration__error" role="alert">
      {{ error }}
    </p>
    <details v-if="loaded" class="voice-configuration__section">
      <summary>{{ t('audioProfiles.narratorTitle') }}</summary>
      <VoiceProfileFields v-model="narrator" :disabled="busy" />
      <div class="voice-configuration__actions">
        <SButton size="lg" :loading="busy" @click="save('narrator')">
          {{ t('audioProfiles.saveNarrator') }}
        </SButton>
        <SButton v-if="narrator" size="lg" variant="ghost" :disabled="busy" @click="narrator = undefined">
          {{ t('audioProfiles.clearNarratorDraft') }}
        </SButton>
      </div>
    </details>
    <details v-if="loaded" class="voice-configuration__section">
      <summary>{{ t('audioProfiles.dictionaryTitle') }}</summary>
      <p>{{ t('audioProfiles.dictionaryHint') }}</p>
      <div v-for="(row, index) in rows" :key="index" class="voice-configuration__row">
        <label><span>{{ t('audioProfiles.localeOptional') }}</span><SInput v-model="row.locale" size="lg" :disabled="busy" /></label>
        <label><span>{{ t('audioProfiles.originalWord') }}</span><SInput v-model="row.text" size="lg" :disabled="busy" /></label>
        <label><span>{{ t('audioProfiles.replacementWord') }}</span><SInput v-model="row.replacement" size="lg" :disabled="busy" /></label>
        <SButton size="lg" variant="ghost" :disabled="busy" @click="rows.splice(index, 1)">
          {{ t('audioProfiles.remove') }}
        </SButton>
      </div>
      <div class="voice-configuration__actions">
        <SButton size="lg" variant="outline" :disabled="busy || rows.length >= 512" @click="rows.push({ locale: '', text: '', replacement: '' })">
          {{ t('audioProfiles.addWord') }}
        </SButton>
        <SButton size="lg" :loading="busy" @click="save('dictionary')">
          {{ t('audioProfiles.saveDictionary') }}
        </SButton>
      </div>
      <div class="voice-configuration__sample">
        <label><span>{{ t('audioProfiles.sampleText') }}</span><SInput v-model="sample" size="lg" /></label>
        <label><span>{{ t('audioProfiles.sampleLocale') }}</span><SInput v-model="sampleLocale" size="lg" /></label>
        <p v-if="spokenSample">
          {{ spokenSample }}
        </p>
      </div>
    </details>
  </section>
</template>

<style scoped>
.voice-configuration {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.voice-configuration__section {
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  padding: 12px;
}
.voice-configuration__section summary {
  min-height: 48px;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-weight: 600;
  color: var(--adv-primary);
}
.voice-configuration__section p {
  color: var(--adv-text-secondary);
  line-height: 1.6;
}
.voice-configuration__row,
.voice-configuration__sample {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.voice-configuration label {
  display: grid;
  gap: 8px;
  min-width: 0;
  font-size: var(--adv-font-body-sm);
}
.voice-configuration__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.voice-configuration__error {
  color: var(--adv-danger);
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .voice-configuration__row,
  .voice-configuration__sample {
    grid-template-columns: 1fr;
  }
}
</style>
