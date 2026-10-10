<script setup lang="ts">
import type { AdvCharacter, AdvVoiceLibrarySnapshot } from '@advjs/types'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

const props = defineProps<{ character: AdvCharacter }>()
const project = useProjectStore()
const { t } = useI18n()
const opened = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const snapshot = shallowRef<AdvVoiceLibrarySnapshot>()
const providerId = ref('')
const voiceId = ref('')
const assetId = ref('')
const replaceSelected = ref(false)
const audio = shallowRef<HTMLAudioElement>()
const source = ref('')
const openButton = shallowRef<InstanceType<typeof AGUIButton>>()
const closeButton = shallowRef<InstanceType<typeof AGUIButton>>()
let controller: AbortController | undefined
let revision = 0

const supported = computed(() => Boolean(project.workspace?.voiceLibrary))
const characterVoices = computed(() => snapshot.value?.voices.filter(voice => voice.characterId === props.character.id) ?? [])
const providers = computed(() => [...new Set(characterVoices.value.flatMap(voice => Object.keys(voice.implementations)))])
const voices = computed(() => characterVoices.value.filter(voice => Boolean(voice.implementations[providerId.value])))
const samples = computed(() => snapshot.value?.samples.filter(sample => sample.characterId === props.character.id && sample.state !== 'rejected') ?? [])
const selected = computed(() => voices.value.find(voice => voice.id === voiceId.value)?.selectedSample)

function releaseAudio() {
  if (audio.value) {
    audio.value.pause()
    audio.value.removeAttribute('src')
    audio.value.load()
  }
  if (source.value)
    URL.revokeObjectURL(source.value)
  source.value = ''
}

function resetPreview() {
  revision++
  controller?.abort()
  controller = undefined
  loading.value = false
  releaseAudio()
  error.value = ''
  replaceSelected.value = false
}

function close(restoreFocus = false) {
  resetPreview()
  opened.value = false
  snapshot.value = undefined
  if (restoreFocus) {
    void nextTick(() => {
      if (!opened.value)
        openButton.value?.$el.focus()
    })
  }
}

async function show() {
  close()
  opened.value = true
  loading.value = true
  controller = new AbortController()
  const current = revision
  void nextTick(() => {
    if (opened.value && current === revision)
      closeButton.value?.$el.focus()
  })
  try {
    const result = await project.workspace!.voiceLibrary!(controller.signal)
    if (current !== revision)
      return
    snapshot.value = result
    providerId.value = providers.value[0] ?? ''
    voiceId.value = voices.value[0]?.id ?? ''
    assetId.value = selected.value?.assetId ?? samples.value[0]?.assetId ?? ''
  }
  catch (cause) {
    if (current === revision)
      error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    if (current === revision)
      loading.value = false
  }
}

function playbackError() {
  // Ignore reset events from a player whose object URL has already been released.
  if (!source.value || audio.value?.getAttribute('src') !== source.value)
    return
  resetPreview()
  error.value = t('characters.voice.playbackError')
}

async function preview() {
  controller?.abort()
  releaseAudio()
  controller = new AbortController()
  const current = ++revision
  loading.value = true
  error.value = ''
  try {
    const blob = await project.workspace!.readVoiceAudio!(assetId.value, controller.signal)
    if (current !== revision || !opened.value)
      return
    source.value = URL.createObjectURL(blob)
  }
  catch (cause) {
    if (current === revision)
      error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    if (current === revision)
      loading.value = false
  }
}

async function select() {
  if (!snapshot.value?.revision || saving.value)
    return
  const current = revision
  saving.value = true
  error.value = ''
  try {
    const result = await project.workspace!.selectVoiceSample!({ voiceId: voiceId.value, assetId: assetId.value, expectedRevision: snapshot.value.revision, replaceSelected: replaceSelected.value })
    if (current === revision && opened.value) {
      snapshot.value = result
      replaceSelected.value = false
    }
  }
  catch (cause) {
    if (current === revision)
      error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    saving.value = false
  }
}

watch(() => props.character.id, () => close())
watch(() => project.workspace, () => close())
watch(assetId, resetPreview)
watch(providerId, () => {
  resetPreview()
  if (!voices.value.some(voice => voice.id === voiceId.value))
    voiceId.value = voices.value[0]?.id ?? ''
  assetId.value = selected.value?.assetId ?? samples.value[0]?.assetId ?? ''
})
watch(voiceId, () => {
  resetPreview()
  assetId.value = selected.value?.assetId ?? samples.value[0]?.assetId ?? ''
})
onBeforeUnmount(() => close())
</script>

<template>
  <section v-if="supported" class="voice-panel" data-testid="voice-panel" @keydown.esc.stop.prevent="close(true)">
    <div class="flex gap-2 items-center justify-between">
      <h3 class="font-bold">
        {{ t('characters.voice.title') }}
      </h3>
      <AGUIButton v-if="!opened" ref="openButton" type="button" :disabled="saving" data-testid="voice-open" @click="show">
        {{ t('characters.voice.open') }}
      </AGUIButton>
      <AGUIButton v-else ref="closeButton" type="button" data-testid="voice-close" @click="close(true)">
        {{ t('characters.voice.close') }}
      </AGUIButton>
    </div>
    <template v-if="opened">
      <p v-if="loading" role="status">
        {{ t('characters.voice.loading') }}
      </p>
      <p v-if="snapshot && !characterVoices.length" role="status">
        {{ t('characters.voice.empty') }}
      </p>
      <template v-if="characterVoices.length">
        <AGUIProperty :label="t('characters.voice.provider')">
          <AGUISelect v-model="providerId" name="providerId" :label="t('characters.voice.provider')" :options="providers" :disabled="saving || loading" />
        </AGUIProperty>
        <AGUIProperty :label="t('characters.voice.identity')">
          <AGUISelect v-model="voiceId" name="voiceId" :label="t('characters.voice.identity')" :options="voices.map(voice => ({ value: voice.id, label: `${voice.label} · ${voice.version}` }))" :disabled="saving || loading" />
        </AGUIProperty>
        <p v-if="selected" role="status">
          {{ t('characters.voice.selected') }}: {{ selected.assetId }}
        </p>
        <AGUIProperty :label="t('characters.voice.sample')">
          <AGUISelect v-model="assetId" name="assetId" :label="t('characters.voice.sample')" :options="samples.map(sample => ({ value: sample.assetId, label: sample.title }))" :disabled="saving || loading" />
        </AGUIProperty>
        <AGUIButton type="button" :disabled="!assetId || loading || saving" data-testid="voice-preview" @click="preview">
          {{ t('characters.voice.preview') }}
        </AGUIButton>
        <audio v-if="source" ref="audio" :src="source" class="max-w-full" controls preload="none" :aria-label="t('characters.voice.sample')" @error="playbackError" />
        <AGUICheckbox v-if="selected && selected.assetId !== assetId" v-model:checked="replaceSelected" name="replaceSelected" :label="t('characters.voice.replace')" :disabled="saving" />
        <AGUIButton type="button" :disabled="!assetId || saving || loading || (Boolean(selected) && selected?.assetId !== assetId && !replaceSelected)" data-testid="voice-select" @click="select">
          {{ t('characters.voice.select') }}
        </AGUIButton>
      </template>
      <p v-if="error" role="alert">
        {{ error }}
      </p>
      <p class="voice-hint">
        {{ t('characters.voice.hint') }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.voice-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid var(--agui-c-divider-light);
  font-size: 12px;
  color: var(--agui-c-text-1);
}
.voice-panel :deep(.agui-select-trigger) {
  width: 100%;
  min-width: 0;
}
.voice-panel > .agui-button {
  align-self: flex-start;
}
.voice-hint {
  color: var(--agui-c-text-2);
  line-height: 1.5;
}
.voice-panel [role='alert'] {
  color: var(--agui-c-danger-text);
}
</style>
