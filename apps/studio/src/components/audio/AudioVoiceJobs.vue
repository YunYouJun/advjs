<script setup lang="ts">
import type { VoiceGenerationBudget, VoiceGenerationJob } from '@advjs/audio'
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVoiceGenerationJobs } from '../../composables/useVoiceGenerationJobs'
import SButton from '../ui/SButton.vue'
import SInput from '../ui/SInput.vue'
import SSelect from '../ui/SSelect.vue'
import AudioVoiceConfiguration from './AudioVoiceConfiguration.vue'

const props = defineProps<{ active: boolean, speakerId?: string, lineId?: string }>()
const emit = defineEmits<{ changed: [], review: [scope: { speakerId: string, lineId: string }] }>()
const { t } = useI18n()
const api = useVoiceGenerationJobs(toRef(props, 'active'), () => emit('changed'))
const { jobs, context, plan, blocked, locales, online, loading, busy, error, running, loginRequired, remoteActive } = api
const chapterId = ref('all')
const speakerId = ref(props.speakerId || 'all')
const lineId = ref(props.lineId || 'all')
const locale = ref('')
const providerId = ref('')
const mode = ref<'chapter' | 'missing' | 'stale'>('missing')
const maxCharacters = ref('5000')
const concurrency = ref('1')
const allowUnknownCost = ref(false)
const costCap = ref('')
const currency = ref('')
const targetLocales = computed(() => speakerId.value === 'all' ? locales.value : Object.keys(context.value?.profiles[speakerId.value]?.locales ?? {}))
const providerOptions = computed(() => (speakerId.value === 'all' ? api.providers(locale.value) : Object.keys(context.value?.profiles[speakerId.value]?.locales?.[locale.value]?.providers ?? {})).map(value => ({ value, label: value })))
const localeOptions = computed(() => targetLocales.value.map(value => ({ value, label: value })))
const speakerOptions = computed(() => [{ value: 'all', label: t('voiceWorkflow.allSpeakers') }, ...[...new Set(context.value?.lines.map(line => line.speakerId) ?? [])].map(value => ({ value, label: value }))])
const targetLines = computed(() => context.value?.lines.filter(line => (chapterId.value === 'all' || line.chapterId === chapterId.value) && (speakerId.value === 'all' || line.speakerId === speakerId.value)) ?? [])
const lineOptions = computed(() => [{ value: 'all', label: t('voiceWorkflow.allLines') }, ...targetLines.value.map(line => ({ value: line.lineId, label: line.displayText }))])
const chapterOptions = computed(() => [{ value: 'all', label: t('audioJobs.allChapters') }, ...(context.value?.chapters.map(chapter => ({ value: chapter.id, label: chapter.title })) ?? [])])
watch(targetLocales, (next) => {
  if (!next.includes(locale.value))
    locale.value = next.find(value => api.providers(value).length > 0) ?? next[0] ?? ''
})
watch(providerOptions, next => !next.some(item => item.value === providerId.value) && (providerId.value = next[0]?.value ?? ''))
watch([() => props.speakerId, () => props.lineId], () => {
  speakerId.value = props.speakerId || 'all'
  lineId.value = props.lineId || 'all'
})
watch([chapterId, speakerId], () => {
  if (!targetLines.value.some(line => line.lineId === lineId.value))
    lineId.value = 'all'
})
watch([chapterId, speakerId, lineId, locale, providerId, mode, maxCharacters, concurrency, costCap, currency, allowUnknownCost], api.invalidatePlan)

function budget(): VoiceGenerationBudget {
  return {
    maxCharacters: Number(maxCharacters.value),
    concurrency: Number(concurrency.value),
    allowUnknownCost: allowUnknownCost.value,
    ...(costCap.value ? { maxCost: { currency: currency.value.trim().toUpperCase(), amountMicros: Math.round(Number(costCap.value) * 1_000_000) } } : {}),
  }
}
function review() {
  void api.review({ chapterId: chapterId.value === 'all' ? '' : chapterId.value, speakerId: speakerId.value === 'all' ? undefined : speakerId.value, lineId: lineId.value === 'all' ? undefined : lineId.value, locale: locale.value, providerId: providerId.value, mode: mode.value, budget: budget() })
}
async function openReview(job: VoiceGenerationJob) {
  await api.reload()
  if (!error.value && props.active) {
    const speakers = new Set(job.tasks.map(task => task.speakerId))
    emit('review', { speakerId: speakers.size === 1 ? job.tasks[0]!.speakerId : '', lineId: job.tasks.length === 1 ? job.tasks[0]!.lineId : '' })
  }
}
function cost(job: VoiceGenerationJob) {
  return job.summary.estimatedCost ? `${job.summary.estimatedCost.currency} ${(job.summary.estimatedCost.amountMicros / 1_000_000).toFixed(6)}` : job.summary.newGenerations ? t('audioJobs.unknownPrice') : '0'
}
function status(job: VoiceGenerationJob) {
  if (job.tasks.some(task => ['unknown', 'running'].includes(task.status)) && !running.value.includes(job.id))
    return 'unknown'
  if (job.cancelled)
    return 'cancelled'
  if (running.value.includes(job.id))
    return 'running'
  if (job.tasks.every(task => task.status === 'committed'))
    return 'committed'
  return job.tasks.some(task => ['failed', 'blocked'].includes(task.status)) ? 'blocked' : 'queued'
}
</script>

<template>
  <section class="voice-jobs" data-testid="voice-jobs" :aria-busy="loading || busy">
    <div class="voice-jobs__heading">
      <div>
        <h2>{{ t('audioJobs.title') }}</h2>
        <p>{{ t(remoteActive ? 'audioService.serverHint' : 'audioJobs.privateHint') }}</p>
      </div>
      <SButton size="lg" variant="outline" :disabled="loading || busy || running.length > 0" @click="api.reload">
        {{ t('audioWorkspace.reload') }}
      </SButton>
    </div>
    <p v-if="!online" class="voice-jobs__notice" role="status">
      {{ t('audioJobs.offlineHint') }}
    </p>
    <p v-if="loginRequired" class="voice-jobs__notice" role="status">
      {{ t('audioService.loginRequired') }}
      <RouterLink to="/login">
        {{ t('audioService.login') }}
      </RouterLink>
    </p>
    <p v-if="!api.canGenerate" class="voice-jobs__notice">
      {{ t('audioJobs.transportHint') }}
    </p>
    <p v-if="error" class="voice-jobs__error" role="alert">
      {{ t(`audioJobs.errors.${error}`, error) }}
    </p>
    <p v-if="loading" role="status">
      {{ t('audioWorkspace.loading') }}
    </p>
    <AudioVoiceConfiguration :active="active" @changed="api.reload(); emit('changed')" />
    <form v-if="context" class="voice-jobs__form" @submit.prevent="review">
      <label>
        <span>{{ t('voiceWorkflow.targetSpeaker') }}</span>
        <SSelect v-model="speakerId" size="lg" :aria-label="t('voiceWorkflow.targetSpeaker')" :options="speakerOptions" :disabled="busy" />
      </label>
      <label>
        <span>{{ t('voiceWorkflow.targetLine') }}</span>
        <SSelect v-model="lineId" size="lg" :aria-label="t('voiceWorkflow.targetLine')" :options="lineOptions" :disabled="busy" />
      </label>
      <label>
        <span>{{ t('audioJobs.chapter') }}</span>
        <SSelect v-model="chapterId" size="lg" :options="chapterOptions" :disabled="busy" />
      </label>
      <label>
        <span>{{ t('audioJobs.locale') }}</span>
        <SSelect v-model="locale" size="lg" :options="localeOptions" :placeholder="t('audioJobs.profileRequired')" :disabled="busy" />
      </label>
      <label>
        <span>{{ t('audioJobs.provider') }}</span>
        <SSelect v-model="providerId" size="lg" :options="providerOptions" :placeholder="t('audioJobs.profileRequired')" :disabled="busy" />
      </label>
      <label>
        <span>{{ t('audioJobs.scope') }}</span>
        <SSelect v-model="mode" size="lg" :disabled="busy" :options="(['chapter', 'missing', 'stale'] as const).map(value => ({ value, label: t(`audioJobs.modes.${value}`) }))" />
      </label>
      <label>
        <span>{{ t('audioJobs.maxCharacters') }}</span>
        <SInput v-model="maxCharacters" type="number" inputmode="numeric" size="lg" :disabled="busy" />
      </label>
      <label>
        <span>{{ t('audioJobs.concurrency') }}</span>
        <SInput v-model="concurrency" type="number" inputmode="numeric" size="lg" :disabled="busy" />
      </label>
      <label>
        <span>{{ t('audioJobs.currency') }}</span>
        <SInput v-model="currency" size="lg" :maxlength="3" :placeholder="t('audioJobs.quoteOnly')" :disabled="busy" />
      </label>
      <label>
        <span>{{ t('audioJobs.costCap') }}</span>
        <SInput v-model="costCap" type="number" inputmode="decimal" size="lg" :placeholder="t('audioJobs.optional')" :disabled="busy" />
      </label>
      <label class="voice-jobs__approval">
        <input v-model="allowUnknownCost" type="checkbox" :disabled="busy">
        <span>{{ t('audioJobs.approveUnknown') }}</span>
      </label>
      <p v-if="!providerOptions.length" class="voice-jobs__notice voice-jobs__wide">
        {{ t('audioJobs.profileHint') }}
      </p>
      <p v-if="context.unidentifiedLines" class="voice-jobs__notice voice-jobs__wide">
        {{ t('audioJobs.unidentified', { count: context.unidentifiedLines }) }}
      </p>
      <ul v-if="blocked.length" class="voice-jobs__wide voice-jobs__blocked">
        <li v-for="line in blocked" :key="line.lineId">
          <code>{{ line.lineId }}</code> · {{ t(`audioJobs.errors.${line.code}`, line.code) }}
        </li>
      </ul>
      <SButton class="voice-jobs__wide" size="lg" type="submit" :loading="busy" :disabled="loading || !locale || !providerId || running.length > 0">
        {{ t('audioJobs.review') }}
      </SButton>
    </form>
    <section v-if="plan" class="voice-jobs__review" :aria-label="t('audioJobs.reviewedPlan')">
      <h3>{{ t('audioJobs.reviewedPlan') }}</h3>
      <dl class="voice-jobs__summary">
        <div><dt>{{ t('audioJobs.lines') }}</dt><dd>{{ plan.summary.lines }}</dd></div>
        <div><dt>{{ t('audioJobs.characters') }}</dt><dd>{{ plan.summary.characters }}</dd></div>
        <div><dt>{{ t('audioJobs.cacheHits') }}</dt><dd>{{ plan.summary.cacheHits }}</dd></div>
        <div><dt>{{ t('audioJobs.generations') }}</dt><dd>{{ plan.summary.newGenerations }}</dd></div>
        <div><dt>{{ t('audioJobs.cost') }}</dt><dd>{{ cost(plan) }}</dd></div>
      </dl>
      <p>{{ t('audioJobs.unselectedHint') }}</p>
      <SButton size="lg" :loading="busy" @click="api.enqueue">
        {{ t('audioJobs.enqueue') }}
      </SButton>
    </section>
    <div class="voice-jobs__list">
      <p v-if="!jobs.length && !loading" class="voice-jobs__notice">
        {{ t('audioJobs.empty') }}
      </p>
      <article v-for="job in jobs" :key="job.id" class="voice-jobs__job" :data-job-id="job.id">
        <div class="voice-jobs__heading">
          <h3>{{ t(`audioJobs.states.${status(job)}`) }}</h3>
          <time :datetime="job.createdAt">{{ new Date(job.createdAt).toLocaleString() }}</time>
        </div>
        <p class="voice-jobs__metrics">
          {{ t('audioJobs.jobSummary', { lines: job.summary.lines, characters: job.summary.characters, hits: job.summary.cacheHits }) }} · {{ cost(job) }}
        </p>
        <p v-if="api.isPrivate(job)" class="voice-jobs__notice">
          {{ t('audioService.privatePlan') }}
        </p>
        <p v-if="job.tasks.some(task => ['unknown', 'running'].includes(task.status)) && !running.includes(job.id)" class="voice-jobs__notice">
          {{ api.canQuery ? t('audioJobs.queryHint') : t('audioJobs.unknownHint') }}
        </p>
        <div class="voice-jobs__actions">
          <SButton v-if="job.tasks.some(task => task.status === 'committed')" size="lg" variant="outline" :disabled="busy || loading || running.length > 0" @click="openReview(job)">
            {{ t('voiceWorkflow.reviewTakes') }}
          </SButton>
          <SButton v-if="api.isPrivate(job) && !job.cancelled" size="lg" variant="outline" :disabled="busy" @click="api.reconcile(job)">
            {{ t('audioService.reconcile') }}
          </SButton>
          <SButton size="lg" :disabled="!api.canRun(job)" :loading="running.includes(job.id)" @click="api.command(job.id, 'run')">
            {{ t('audioJobs.run') }}
          </SButton>
          <SButton v-if="!api.isPrivate(job) && !job.cancelled && job.tasks.some(task => task.status !== 'committed')" size="lg" variant="outline" @click="api.command(job.id, 'cancel')">
            {{ t('audioJobs.cancel') }}
          </SButton>
          <SButton v-if="!api.isPrivate(job) && job.cancelled" size="lg" variant="outline" @click="api.command(job.id, 'resume')">
            {{ t('audioJobs.resume') }}
          </SButton>
          <SButton v-if="!api.isPrivate(job) && job.tasks.some(task => task.status === 'failed')" size="lg" variant="outline" :disabled="running.includes(job.id)" @click="api.command(job.id, 'retry')">
            {{ t('audioJobs.retry') }}
          </SButton>
        </div>
        <details>
          <summary>{{ t('audioJobs.details') }}</summary>
          <ul>
            <li v-for="task in job.tasks" :key="task.id">
              <div>{{ task.speakerId }} · {{ task.locale }} · {{ task.providerId }} / {{ task.model }}</div>
              <code>{{ task.lineId }}</code>
              <div>{{ t(`audioJobs.states.${task.status}`) }} · {{ t('audioJobs.taskCharacters', { count: task.characterCount }) }}</div>
              <code v-if="task.errorCode">{{ task.errorCode }}</code>
            </li>
          </ul>
        </details>
      </article>
    </div>
  </section>
</template>

<style scoped>
.voice-jobs {
  display: grid;
  gap: 20px;
  min-width: 0;
}
.voice-jobs h2,
.voice-jobs h3 {
  margin: 0 0 8px;
  font-size: var(--adv-font-heading);
}
.voice-jobs p {
  margin: 0;
  line-height: 1.6;
  color: var(--adv-text-secondary);
}
.voice-jobs__form :deep(.s-select-trigger) {
  min-width: 0;
}
.voice-jobs__form :deep(.s-select-trigger > span:first-child) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.voice-jobs__heading {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
}
.voice-jobs__heading > div {
  flex: 1;
  min-width: 180px;
}
.voice-jobs__heading time {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
}
.voice-jobs__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.voice-jobs__form label {
  display: grid;
  gap: 8px;
  min-width: 0;
  font-size: var(--adv-font-body-sm);
}
.voice-jobs__wide,
.voice-jobs__approval {
  grid-column: 1 / -1;
}
.voice-jobs__form .voice-jobs__approval {
  display: flex;
  align-items: center;
  min-height: 48px;
  cursor: pointer;
}
.voice-jobs__approval input {
  width: 24px;
  height: 24px;
  accent-color: var(--adv-primary);
  flex-shrink: 0;
}
.voice-jobs__review,
.voice-jobs__job {
  display: grid;
  gap: 16px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  padding: 16px;
  min-width: 0;
}
.voice-jobs__review {
  background: var(--adv-primary-soft);
}
.voice-jobs__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 16px;
  margin: 0;
}
.voice-jobs__summary dt {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
}
.voice-jobs__summary dd {
  margin: 4px 0 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.voice-jobs__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.voice-jobs__list {
  display: grid;
  gap: 16px;
}
.voice-jobs__job summary {
  cursor: pointer;
  min-height: 48px;
  display: flex;
  align-items: center;
  color: var(--adv-primary);
}
.voice-jobs__job ul,
.voice-jobs__blocked {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 16px;
}
.voice-jobs code {
  overflow-wrap: anywhere;
  font-size: var(--adv-font-caption);
}
.voice-jobs__notice {
  padding: 12px;
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-elevated);
  font-size: var(--adv-font-body-sm);
}
.voice-jobs .voice-jobs__error {
  padding: 12px;
  border: 1px solid var(--adv-danger);
  border-radius: var(--adv-radius-sm);
  color: var(--adv-danger);
  overflow-wrap: anywhere;
}
@media (max-width: 420px) {
  .voice-jobs__form {
    grid-template-columns: 1fr;
  }
}
</style>
