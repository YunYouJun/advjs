<script setup lang="ts">
import type { CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportHost } from '../../composables/useCreativeArtImport'
import type { CreativeVoiceReview, CreativeVoiceTarget } from '../../utils/creativeVoiceImport'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { commitCreativeVoiceImport, inspectCreativeVoice, readCreativeVoiceTargets, reviewCreativeVoiceImport } from '../../utils/creativeVoiceImport'
import { voiceWorkflowLocation } from '../../utils/voiceWorkflow'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ run: CreativeTeamRun, busy: boolean, host: () => Promise<CreativeArtImportHost> }>()
const emit = defineEmits<{ busy: [value: boolean], changed: [] }>()
const { t } = useI18n()
const proposals = computed(() => props.run.artifacts.filter(item => item.output?.kind === 'voice-direction' && ['selected', 'adopted'].includes(item.status)))
const artifactId = shallowRef('')
const selected = computed(() => proposals.value.find(item => item.id === artifactId.value))
const direction = computed(() => selected.value?.output?.kind === 'voice-direction' ? selected.value.output : undefined)
const targets = shallowRef<CreativeVoiceTarget[]>([])
const targetIndex = shallowRef('0')
const target = computed(() => targets.value[Number(targetIndex.value)])
const providerId = shallowRef('')
const file = shallowRef<File>()
const attribution = shallowRef('')
const review = shallowRef<CreativeVoiceReview>()
const imported = shallowRef<CreativeVoiceTarget>()
const working = shallowRef(false)
const error = shallowRef('')
let epoch = 0
const blocked = computed(() => props.busy || working.value || props.run.tasks.some(item => ['running', 'reconcile_required'].includes(item.status)) || Boolean(props.run.milestones?.some(item => item.status === 'prepared')))
watch(working, value => emit('busy', value))
watch(() => props.run.id + proposals.value.map(item => `${item.id}:${item.fingerprint}`).join(','), () => {
  epoch++
  working.value = false
  targets.value = []
  review.value = undefined
  imported.value = undefined
  file.value = undefined
  artifactId.value = proposals.value[0]?.id ?? ''
}, { immediate: true })
watch([artifactId, targetIndex, providerId, attribution, file], () => review.value = undefined)
watch(target, value => providerId.value = value?.providers[0]?.id ?? '')
onBeforeUnmount(() => {
  epoch++
  emit('busy', false)
})
async function operate(action: (host: CreativeArtImportHost) => Promise<void>) {
  if (blocked.value)
    return
  const current = epoch
  const runId = props.run.id
  working.value = true
  error.value = ''
  try {
    const host = await props.host()
    const assertCurrent = () => {
      host.assertCurrent()
      if (current !== epoch || props.run.id !== runId)
        throw new Error('CREATIVE_VOICE_SCOPE_CHANGED')
    }
    assertCurrent()
    await action({ ...host, assertCurrent })
  }
  catch {
    if (current === epoch)
      error.value = t('creativeTeam.voiceImport.error')
  }
  finally {
    if (current === epoch)
      working.value = false
  }
}
async function load() {
  await operate(async ({ fs, assertCurrent }) => {
    const result = await readCreativeVoiceTargets(fs, props.run, artifactId.value, assertCurrent)
    assertCurrent()
    targets.value = result
    targetIndex.value = '0'
  })
}
async function inspect() {
  const current = target.value
  const input = file.value
  const provider = providerId.value
  const source = attribution.value
  if (!current || !input)
    return
  await operate(async ({ fs, assertCurrent }) => {
    const audio = await inspectCreativeVoice(input)
    assertCurrent()
    const result = await reviewCreativeVoiceImport(fs, props.run, current, audio, provider, source, assertCurrent)
    assertCurrent()
    review.value = result
  })
}
async function commit() {
  const value = review.value
  if (!value)
    return
  await operate(async ({ fs, assertCurrent }) => {
    await commitCreativeVoiceImport(fs, props.run, value, assertCurrent)
    assertCurrent()
    imported.value = value.target
    review.value = undefined
    file.value = undefined
    emit('changed')
  })
}
</script>

<template>
  <section v-if="proposals.length" class="voice-import" data-testid="creative-voice-import">
    <h2>{{ t('creativeTeam.voiceImport.title') }}</h2>
    <p>{{ t('creativeTeam.voiceImport.hint') }}</p>
    <p>{{ t('creativeTeam.voiceImport.localScope') }}</p>
    <label>{{ t('creativeTeam.voiceImport.proposal') }}<select v-model="artifactId" :disabled="blocked" @change="targets = []; imported = undefined"><option v-for="proposal in proposals" :key="proposal.id" :value="proposal.id">{{ proposal.summary }}</option></select></label>
    <template v-if="direction">
      <ul>
        <li v-for="cast in direction.cast" :key="cast.speakerId">
          <strong>{{ cast.speakerId }}</strong> · {{ cast.designBrief }} · {{ cast.performance }} <RouterLink :to="voiceWorkflowLocation('design', cast.speakerId)">
            {{ t('creativeTeam.voiceImport.design') }}
          </RouterLink>
        </li>
      </ul>
      <p v-if="direction.dictionary.length">
        {{ t('creativeTeam.voiceImport.dictionaryHint') }}
      </p>
      <ul>
        <li v-for="word in direction.dictionary" :key="word.term">
          {{ word.term }} → {{ word.pronunciation }}
        </li>
      </ul>
    </template>
    <SButton size="lg" variant="outline" :disabled="blocked" @click="load">
      {{ t('creativeTeam.voiceImport.resolve') }}
    </SButton>
    <p v-if="error" role="alert" class="voice-import__error">
      {{ error }}
    </p>
    <form v-if="targets.length && !imported" @submit.prevent="inspect">
      <label>{{ t('creativeTeam.voiceImport.line') }}<select v-model="targetIndex" :disabled="blocked"><option v-for="(line, index) in targets" :key="line.lineId" :value="String(index)">{{ line.request.speakerId }} · {{ line.request.text }}</option></select></label>
      <template v-if="target">
        <p>{{ target.request.path }}:{{ target.request.line }} · <code>{{ target.lineId }}</code></p>
        <p>{{ target.request.instruction }}</p>
        <div class="voice-import__links">
          <RouterLink :to="voiceWorkflowLocation('jobs', target.request.speakerId, target.lineId)">
            {{ t('creativeTeam.voiceImport.jobs') }}
          </RouterLink><RouterLink :to="voiceWorkflowLocation('review', target.request.speakerId, target.lineId)">
            {{ t('creativeTeam.voiceImport.review') }}
          </RouterLink>
        </div>
        <p v-if="!target.providers.length">
          {{ t('creativeTeam.voiceImport.profileRequired') }}
        </p>
        <template v-else>
          <label>{{ t('creativeTeam.voiceImport.provider') }}<select v-model="providerId" :disabled="blocked"><option v-for="provider in target.providers" :key="provider.id" :value="provider.id">{{ provider.id }} · {{ provider.model }} · {{ provider.voiceId }} · {{ provider.source }}</option></select></label>
          <label>{{ t('creativeTeam.voiceImport.file') }}<input type="file" accept="audio/wav,.wav" :disabled="blocked" @change="file = ($event.target as HTMLInputElement).files?.[0]"></label>
          <label>{{ t('creativeTeam.voiceImport.attribution') }}<textarea v-model="attribution" :disabled="blocked" maxlength="1000" required /></label>
          <SButton type="submit" size="lg" :disabled="blocked || !file || !attribution.trim()">
            {{ t('creativeTeam.voiceImport.inspect') }}
          </SButton>
        </template>
      </template>
    </form>
    <section v-if="review" class="voice-import__review">
      <p>{{ t('creativeTeam.voiceImport.unselected') }}</p>
      <p>{{ review.duration.toFixed(3) }} s · {{ review.sampleRate }} Hz · {{ review.data.byteLength }} B</p><code>{{ review.sha256 }}</code>
      <p>{{ review.attribution }}</p>
      <details v-for="change in review.changes" :key="change.path">
        <summary>{{ change.path }}</summary><pre>{{ change.expected ?? '∅' }}</pre><pre>{{ change.content ?? '∅' }}</pre>
      </details>
      <SButton size="lg" :disabled="blocked" @click="commit">
        {{ t('creativeTeam.voiceImport.commit') }}
      </SButton>
    </section>
    <p v-if="imported" role="status">
      {{ t('creativeTeam.voiceImport.imported') }} <RouterLink :to="voiceWorkflowLocation('review', imported.request.speakerId, imported.lineId)">
        {{ t('creativeTeam.voiceImport.review') }}
      </RouterLink>
    </p>
  </section>
</template>

<style scoped>
.voice-import {
  min-width: 0;
  margin-top: var(--adv-space-lg);
  padding-top: var(--adv-space-lg);
  border-top: 1px solid var(--adv-border-subtle);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.voice-import h2 {
  font-size: var(--adv-font-title);
}
.voice-import form,
.voice-import label {
  display: grid;
  gap: var(--adv-space-sm);
  margin-block: var(--adv-space-md);
}
.voice-import select,
.voice-import textarea,
.voice-import input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-card);
  color: var(--adv-text-primary);
}
.voice-import__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-md);
}
.voice-import pre {
  overflow: auto;
  max-height: 280px;
  padding: var(--adv-space-sm);
  background: var(--adv-surface-elevated);
  white-space: pre-wrap;
}
.voice-import__error {
  color: var(--adv-danger);
}
.voice-import a {
  color: var(--adv-primary);
}
</style>
