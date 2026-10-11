<script setup lang="ts">
import type { AudioVoiceProfiles } from '@advjs/types'
import { AUDIO_VOICE_PROFILES_PATH, createAudioVoiceProfiles, parseAudioVoiceProfiles } from '@advjs/audio'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useAudioStore } from '../../../stores/useAudioStore'
import { useProjectDrafts } from '../../../stores/useProjectDrafts'
import { useProjectStore } from '../../../stores/useProjectStore'
import CharacterVoiceProfileEditor from '../../character/CharacterVoiceProfileEditor.vue'

const project = useProjectStore()
const audio = useAudioStore()
const drafts = useProjectDrafts()
const id = useId()
const profiles = ref<AudioVoiceProfiles>(createAudioVoiceProfiles())
const narrator = computed({
  get: () => profiles.value.narrator,
  set: (value: AudioVoiceProfiles['narrator']) => {
    if (value)
      profiles.value.narrator = value
    else delete profiles.value.narrator
  },
})
const original = ref(JSON.stringify(profiles.value))
const revision = ref('')
const expectedSource = ref<string | null>(null)
const busy = ref(false)
const error = ref('')
const status = ref('')
let sequence = 0
const source = computed(() => project.project?.files[AUDIO_VOICE_PROFILES_PATH] ?? null)
const dirty = computed(() => JSON.stringify(profiles.value) !== original.value)
const writable = computed(() => audio.supportedRoot && Boolean(project.workspace?.writeFiles))
const conflict = computed(() => source.value !== expectedSource.value)
const validation = computed(() => {
  try {
    parseAudioVoiceProfiles(profiles.value)
    return ''
  }
  catch (failure) { return failure instanceof Error ? failure.message : String(failure) }
})
function apply(result: { profiles: AudioVoiceProfiles, revision: string }) {
  profiles.value = result.profiles
  original.value = JSON.stringify(result.profiles)
  revision.value = result.revision
  expectedSource.value = source.value
}
async function reload() {
  const current = ++sequence
  busy.value = true
  error.value = ''
  status.value = ''
  try {
    const result = await audio.authoring().readVoiceProfiles()
    if (current === sequence)
      apply(result)
  }
  catch (failure) {
    if (current === sequence)
      error.value = failure instanceof Error ? failure.message : String(failure)
  }
  finally {
    if (current === sequence)
      busy.value = false
  }
}
async function save() {
  if (!writable.value || validation.value || busy.value || !revision.value)
    return false
  const current = sequence
  const workspace = project.workspace
  busy.value = true
  error.value = ''
  try {
    const result = await audio.authoring().saveVoiceProfiles({ expectedRevision: revision.value, profiles: profiles.value })
    if (current !== sequence || project.workspace !== workspace)
      return false
    apply(result)
    status.value = '旁白配音配置已保存。角色配音在角色属性中编辑。'
    return true
  }
  catch (failure) {
    if (current === sequence)
      error.value = failure instanceof Error ? failure.message : String(failure)
    return false
  }
  finally { busy.value = false }
}
watch(() => project.workspace, () => {
  void reload()
}, { immediate: true })
watch(source, () => {
  if (!dirty.value && !busy.value)
    void reload()
})
watch(dirty, value => drafts.register(id, { dirty: value, save }), { immediate: true })
onBeforeUnmount(() => {
  sequence++
  drafts.remove(id)
})
</script>

<template>
  <section aria-label="项目旁白配音" class="ae-narrator-panel">
    <p class="ae-resource-caption p-2">
      旁白是项目级配音身份。对白角色的音色在各自角色属性中配置。
    </p>
    <fieldset :disabled="busy || !writable" class="ae-narrator-fields">
      <CharacterVoiceProfileEditor v-model="narrator" :id-prefix="id" />
    </fieldset>
    <p v-if="error || validation" class="ae-resource-error p-2" role="alert">
      {{ error || validation }}
    </p>
    <p v-if="conflict" class="ae-resource-caption p-2" role="status">
      项目配置已变化；草稿已保留，请载入最新版本后重新编辑。
    </p>
    <p v-if="status" class="ae-resource-caption p-2" role="status">
      {{ status }}
    </p>
    <div class="ae-resource-actions p-2">
      <AGUIButton :disabled="busy" @click="reload">
        载入项目版本
      </AGUIButton>
      <AGUIButton theme="primary" :disabled="!writable || busy || Boolean(validation) || conflict || (!dirty && source !== null)" data-testid="narrator-profile-save" @click="save">
        保存旁白配置
      </AGUIButton>
    </div>
    <p class="ae-resource-caption p-2">
      {{ AUDIO_VOICE_PROFILES_PATH }} · 版本 {{ profiles.revision }}
    </p>
  </section>
</template>

<style scoped>
.ae-narrator-fields {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
</style>
