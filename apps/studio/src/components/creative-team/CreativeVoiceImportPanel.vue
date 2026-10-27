<script setup lang="ts">
import type { CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportHost } from '../../composables/useCreativeArtImport'
import type { CreativeMediaSubmit } from '../../utils/creativeMediaCandidate'
import type { CreativeVoiceTarget } from '../../utils/creativeVoiceImport'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCreativeVoiceImport } from '../../composables/useCreativeVoiceImport'
import { assertCreativeVoiceReview, inspectCreativeVoice, readCreativeVoiceTargets, reviewCreativeVoiceImport } from '../../utils/creativeVoiceImport'
import { voiceWorkflowLocation } from '../../utils/voiceWorkflow'
import SButton from '../ui/SButton.vue'
import CreativeVoiceImportCandidate from './CreativeVoiceImportCandidate.vue'

const props = defineProps<{ run: CreativeTeamRun, busy: boolean, host: () => Promise<CreativeArtImportHost>, submitMedia?: CreativeMediaSubmit }>()
const emit = defineEmits<{ busy: [value: boolean], changed: [] }>()
const { t } = useI18n()
const proposals = computed(() => props.run.artifacts.filter(item => item.output?.kind === 'voice-direction' && ['selected', 'adopted'].includes(item.status)))
const artifactId = shallowRef('')
const selected = computed(() => proposals.value.find(item => item.id === artifactId.value))
const direction = computed(() => selected.value?.output?.kind === 'voice-direction' ? selected.value.output : undefined)
const legacyFlow = computed(() => direction.value?.lines.some(line => line.path.endsWith('.chapter.json') && line.lineId === undefined))
const targets = shallowRef<CreativeVoiceTarget[]>([])
const targetIndex = shallowRef('0')
const target = computed(() => targets.value[Number(targetIndex.value)])
const providerId = shallowRef('')
const file = shallowRef<File>()
const attribution = shallowRef('')
const working = shallowRef(false)
const error = shallowRef('')
let epoch = 0
const session = useCreativeVoiceImport({ run: () => props.run, host: props.host, changed: () => emit('changed'), submitMedia: () => props.submitMedia })
const { rows, inspections, busy: journalBusy, loading: journalLoading, error: journalError } = session
const visible = computed(() => proposals.value.length || rows.value.length)
const pending = computed(() => rows.value.some(item => ['registering', 'restoring'].includes(item.state)))
const candidates = computed(() => rows.value.map((entry) => {
  let stale = false
  try {
    if (entry.managed) {
      const parent = props.run.artifacts.find(item => item.id === entry.review.target.artifactId && item.fingerprint === entry.review.target.artifactFingerprint)
      if (!parent || !['selected', 'adopted'].includes(parent.status))
        throw new Error('Source changed')
    }
    else {
      assertCreativeVoiceReview(props.run, entry.review)
    }
  }
  catch {
    stale = true
  }
  const selectedTake = props.run.artifacts.some(item => item.status === 'adopted' && item.media?.target.kind === 'voice' && item.media.target.phase === 'selected' && item.media.target.takeId === entry.review.takeId)
  return { entry, stale, selectedTake }
}))
const blocked = computed(() => props.busy || working.value || journalBusy.value || journalLoading.value || props.run.tasks.some(item => ['running', 'reconcile_required'].includes(item.status)) || Boolean(props.run.milestones?.some(item => item.status === 'prepared')))
const localBusy = computed(() => working.value || journalBusy.value || journalLoading.value)
watch(localBusy, value => emit('busy', value))
watch(() => props.run.id + proposals.value.map(item => `${item.id}:${item.fingerprint}`).join(','), () => {
  epoch++
  working.value = false
  targets.value = []
  file.value = undefined
  artifactId.value = proposals.value[0]?.id ?? ''
}, { immediate: true })
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
  if (legacyFlow.value)
    return
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
    if (!await session.stage(result))
      error.value = t('creativeTeam.mediaRecovery.error')
  })
}
</script>

<template>
  <section v-if="visible" class="voice-import" data-testid="creative-voice-import">
    <h2>{{ t('creativeTeam.voiceImport.title') }}</h2>
    <p>{{ t(submitMedia ? 'creativeTeam.mediaMilestone.voiceHint' : 'creativeTeam.voiceImport.hint') }}</p>
    <p>{{ t(submitMedia ? 'creativeTeam.mediaMilestone.scope' : 'creativeTeam.voiceImport.localScope') }}</p>
    <label>{{ t('creativeTeam.voiceImport.proposal') }}<select v-model="artifactId" :disabled="blocked" @change="targets = []"><option v-for="proposal in proposals" :key="proposal.id" :value="proposal.id">{{ proposal.summary }}</option></select></label>
    <template v-if="direction">
      <p v-if="direction.locale" role="status">
        {{ t('creativeTeam.voicePlan.adoptFirst') }}
      </p>
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
    <p v-if="legacyFlow" role="status">
      {{ t('creativeTeam.voiceImport.legacyFlow') }}
    </p>
    <SButton size="lg" variant="outline" :disabled="blocked || pending || legacyFlow" @click="load">
      {{ t('creativeTeam.voiceImport.resolve') }}
    </SButton>
    <p v-if="error || journalError" role="alert" class="voice-import__error">
      {{ error || t('creativeTeam.mediaRecovery.error') }}
    </p>
    <p v-if="pending" role="status">
      {{ t('creativeTeam.mediaRecovery.pending') }}
    </p>
    <form v-if="targets.length && !pending" @submit.prevent="inspect">
      <label>{{ t('creativeTeam.voiceImport.line') }}<select v-model="targetIndex" :disabled="blocked"><option v-for="(line, index) in targets" :key="line.lineId" :value="String(index)">{{ line.request.speakerId }} · {{ line.request.text }}</option></select></label>
      <template v-if="target">
        <p>{{ target.request.path }}{{ target.request.line === undefined ? '' : `:${target.request.line}` }} · {{ target.address ?? target.lineId }} · <code>{{ target.lineId }}</code></p>
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
    <CreativeVoiceImportCandidate v-for="candidate in candidates" :key="candidate.entry.id" v-bind="candidate" :actual="inspections[candidate.entry.id]" :disabled="blocked" :managed-available="Boolean(submitMedia)" @register="session.register(candidate.entry.id)" @select="session.select(candidate.entry.id)" @reconcile="session.reconcile(candidate.entry.id)" @restore="session.restore(candidate.entry.id)" @abandon="session.abandon(candidate.entry.id)" @discard="session.discard(candidate.entry.id)" />
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
