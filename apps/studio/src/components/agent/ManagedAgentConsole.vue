<script setup lang="ts">
import type { AgentTaskStatus } from '../../agent/core/contracts'
import { IonIcon, toastController } from '@ionic/vue'
import { alertCircleOutline, checkmarkCircleOutline, copyOutline, refreshOutline, stopCircleOutline } from 'ionicons/icons'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseManagedCapabilityResult } from '../../agent/capabilities'
import { useAgentProposalStore } from '../../stores/useAgentProposalStore'
import { useManagedAgentStore } from '../../stores/useManagedAgentStore'
import SButton from '../ui/SButton.vue'

defineProps<{
  loggedIn: boolean
}>()

const { t, locale } = useI18n()
const store = useManagedAgentStore()
const proposalStore = useAgentProposalStore()
const {
  points,
  task,
  error,
  isRefreshing,
  isCancelling,
  isConfigured,
  status,
  hasActiveTask,
} = storeToRefs(store)

const pipeline: AgentTaskStatus[] = ['authorizing', 'queued', 'running', 'settling', 'completed']
const activePipelineIndex = computed(() => status.value ? pipeline.indexOf(status.value) : -1)
const isExceptional = computed(() => Boolean(status.value && !pipeline.includes(status.value)))
const isCompleted = computed(() => status.value === 'completed')
const canCancel = computed(() => Boolean(
  hasActiveTask.value
  && (!status.value || ['authorizing', 'queued', 'running', 'settling'].includes(status.value)),
))
const canReconnect = computed(() => Boolean(
  task.value?.taskId
  && !task.value.connecting
  && (error.value?.retryable || (status.value && ['authorizing', 'queued', 'running', 'settling'].includes(status.value))),
))
const requestId = computed(() => error.value?.requestId)
const reservedEstimate = computed(() => task.value?.snapshot?.reservedMicroPoints ?? points.value?.reservedMicroPoints ?? 0)
const actualCharge = computed(() => task.value?.usage?.chargedMicroPoints ?? task.value?.snapshot?.points.chargedMicroPoints ?? 0)
const structuredResult = computed(() => task.value?.snapshot
  ? parseManagedCapabilityResult(task.value.snapshot.capability, task.value.streamText)
  : undefined)
const liveMessage = computed(() => {
  if (error.value)
    return t(`managedAi.errors.${error.value.code}`)
  if (task.value?.recovering)
    return t('managedAi.recovering')
  if (status.value)
    return t(`managedAi.status.${status.value}`)
  return t('managedAi.idle')
})

function formatPoints(microPoints: number): string {
  return new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(microPoints / 1_000)
}

async function copyRequestId(): Promise<void> {
  if (!requestId.value)
    return
  try {
    await navigator.clipboard.writeText(requestId.value)
    const toast = await toastController.create({
      message: t('managedAi.requestIdCopied'),
      duration: 1600,
      position: 'top',
    })
    await toast.present()
  }
  catch {
    const toast = await toastController.create({
      message: t('managedAi.copyFailed'),
      duration: 1800,
      position: 'top',
    })
    await toast.present()
  }
}
</script>

<template>
  <section class="agent-console" aria-labelledby="managed-ai-title">
    <header class="agent-console__header">
      <div>
        <p class="agent-console__eyebrow">
          {{ $t('managedAi.eyebrow') }}
        </p>
        <h2 id="managed-ai-title" class="agent-console__title">
          {{ $t('managedAi.title') }}
        </h2>
      </div>
      <span
        class="agent-console__signal"
        :class="{
          'agent-console__signal--active': hasActiveTask,
          'agent-console__signal--error': error,
        }"
        aria-hidden="true"
      />
    </header>

    <p class="sr-only" aria-live="polite" aria-atomic="true">
      {{ liveMessage }}
    </p>

    <div v-if="!loggedIn" class="agent-console__notice">
      <IonIcon :icon="alertCircleOutline" aria-hidden="true" />
      <div>
        <strong>{{ $t('managedAi.signInTitle') }}</strong>
        <p>{{ $t('managedAi.signInBody') }}</p>
        <router-link class="agent-console__text-link" to="/login">
          {{ $t('managedAi.signIn') }}
        </router-link>
      </div>
    </div>

    <div v-else-if="!isConfigured" class="agent-console__notice">
      <IonIcon :icon="alertCircleOutline" aria-hidden="true" />
      <div>
        <strong>{{ $t('managedAi.unavailableTitle') }}</strong>
        <p>{{ $t('managedAi.unavailableBody') }}</p>
      </div>
    </div>

    <template v-else>
      <dl class="agent-console__points" :aria-label="$t('managedAi.pointsSummary')">
        <div>
          <dt>{{ $t('managedAi.available') }}</dt>
          <dd>{{ formatPoints(points?.availableMicroPoints ?? 0) }}</dd>
        </div>
        <div>
          <dt>{{ $t('managedAi.reserved') }}</dt>
          <dd>{{ formatPoints(points?.reservedMicroPoints ?? 0) }}</dd>
        </div>
        <div>
          <dt>{{ $t('managedAi.actual') }}</dt>
          <dd>{{ formatPoints(actualCharge) }}</dd>
        </div>
      </dl>
      <p v-if="points?.reservedMicroPoints" class="agent-console__reservation-note">
        {{ $t('managedAi.reservationNote') }}
      </p>

      <div class="agent-console__tape" aria-hidden="true">
        <span
          v-for="(stage, index) in pipeline"
          :key="stage"
          class="agent-console__tape-cell"
          :class="{
            'agent-console__tape-cell--done': activePipelineIndex >= index,
            'agent-console__tape-cell--current': activePipelineIndex === index && !isCompleted,
          }"
        />
      </div>

      <ol class="agent-console__stages" :aria-label="$t('managedAi.lifecycle')">
        <li
          v-for="(stage, index) in pipeline"
          :key="stage"
          :class="{
            'agent-console__stage--done': activePipelineIndex >= index,
            'agent-console__stage--current': activePipelineIndex === index,
          }"
        >
          <span>{{ index + 1 }}</span>
          <small>{{ $t(`managedAi.status.${stage}`) }}</small>
        </li>
      </ol>

      <div class="agent-console__task-card">
        <div class="agent-console__task-heading">
          <span class="agent-console__status" :data-tone="isExceptional ? 'alert' : isCompleted ? 'success' : 'normal'">
            <IonIcon v-if="isCompleted" :icon="checkmarkCircleOutline" aria-hidden="true" />
            <IonIcon v-else-if="isExceptional || error" :icon="alertCircleOutline" aria-hidden="true" />
            {{ status ? $t(`managedAi.status.${status}`) : $t('managedAi.idle') }}
          </span>
          <span v-if="task?.connecting" class="agent-console__connection">{{ $t('managedAi.live') }}</span>
          <span v-else-if="task?.recovering || isRefreshing" class="agent-console__connection">{{ $t('managedAi.recovering') }}</span>
        </div>

        <p v-if="!task" class="agent-console__empty">
          {{ $t('managedAi.idleBody') }}
        </p>
        <template v-else>
          <p v-if="task.snapshot" class="agent-console__capability">
            {{ $t(`managedAi.capability.${task.snapshot.capability}`) }}
          </p>
          <ol v-if="structuredResult?.kind === 'plot-suggestions'" class="agent-console__results">
            <li v-for="suggestion in structuredResult.suggestions" :key="suggestion.label">
              <strong>{{ suggestion.label }}</strong>
              <span>{{ suggestion.synopsis }}</span>
              <small>{{ suggestion.hook }}</small>
            </li>
          </ol>
          <ol v-else-if="structuredResult?.kind === 'roleplay-lines'" class="agent-console__results">
            <li v-for="(line, index) in structuredResult.lines" :key="`${line.speakerId}:${index}`">
              <strong>{{ line.speakerName }} · @{{ line.speakerId }}</strong>
              <span>{{ line.content }}</span>
            </li>
          </ol>
          <p v-else-if="task.streamText" class="agent-console__stream">
            {{ task.streamText }}
          </p>
          <p v-else-if="task.snapshot?.proposal" class="agent-console__stream">
            {{ task.snapshot.proposal.summary }}
          </p>
          <p v-else class="agent-console__empty">
            {{ liveMessage }}
          </p>

          <dl class="agent-console__cost-row">
            <div>
              <dt>{{ $t('managedAi.estimatedMaximum') }}</dt>
              <dd>{{ formatPoints(reservedEstimate) }}</dd>
            </div>
            <div>
              <dt>{{ $t('managedAi.actualCharge') }}</dt>
              <dd>{{ formatPoints(actualCharge) }}</dd>
            </div>
          </dl>
        </template>
      </div>

      <div v-if="error" class="agent-console__error" role="alert">
        <strong>{{ $t(`managedAi.errors.${error.code}`) }}</strong>
        <p>{{ error.retryable ? $t('managedAi.retryable') : $t('managedAi.notRetryable') }}</p>
        <button v-if="requestId" type="button" class="agent-console__request" @click="copyRequestId">
          <span>{{ $t('managedAi.requestId') }}</span>
          <code>{{ requestId }}</code>
          <IonIcon :icon="copyOutline" aria-hidden="true" />
        </button>
      </div>

      <div v-if="task" class="agent-console__actions">
        <SButton
          v-if="proposalStore.candidate"
          size="sm"
          variant="secondary"
          @click="proposalStore.open"
        >
          {{ $t('proposalReview.open') }}
        </SButton>
        <SButton
          v-if="canReconnect"
          size="sm"
          variant="outline"
          :loading="task.recovering"
          @click="store.reconnect"
        >
          <IonIcon :icon="refreshOutline" aria-hidden="true" />
          {{ $t('managedAi.reconnect') }}
        </SButton>
        <SButton
          v-if="canCancel"
          size="sm"
          variant="danger"
          :loading="isCancelling"
          @click="store.cancelActiveTask"
        >
          <IonIcon :icon="stopCircleOutline" aria-hidden="true" />
          {{ $t('managedAi.cancel') }}
        </SButton>
      </div>

      <p class="agent-console__billing-note">
        {{ $t('managedAi.billingNote') }}
      </p>
      <p v-if="hasActiveTask" class="agent-console__concurrency-note">
        {{ $t('managedAi.concurrencyNote') }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.agent-console {
  --console-ink: #17131f;
  --console-purple: #7c3aed;
  --console-gold: #d4a853;
  --console-mint: #54d6b2;
  --console-red: #df5b63;
  --console-paper: #f7f5fb;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 18px 16px;
  color: var(--console-paper);
  background: var(--console-ink);
  font-family: var(--adv-font-family);
}

.agent-console__header,
.agent-console__task-heading,
.agent-console__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.agent-console__results {
  display: grid;
  gap: 8px;
  max-height: 250px;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.agent-console__results li {
  display: grid;
  gap: 3px;
  padding: 9px;
  border: 1px solid rgba(247, 245, 251, 0.12);
  background: rgba(247, 245, 251, 0.04);
}

.agent-console__results strong,
.agent-console__results span,
.agent-console__results small {
  display: block;
}

.agent-console__results small {
  color: var(--console-gold);
}

.agent-console__eyebrow {
  margin: 0 0 3px;
  color: var(--console-gold);
  font-family: var(--adv-font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.agent-console__title {
  margin: 0;
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.agent-console__signal {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(247, 245, 251, 0.42);
  border-radius: 50%;
}

.agent-console__signal--active {
  border-color: var(--console-mint);
  background: var(--console-mint);
  box-shadow: 0 0 0 4px rgba(84, 214, 178, 0.12);
}

.agent-console__signal--error {
  border-color: var(--console-red);
  background: var(--console-red);
  box-shadow: none;
}

.agent-console__points {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 20px 0 16px;
  border-block: 1px solid rgba(247, 245, 251, 0.12);
}

.agent-console__points div {
  min-width: 0;
  padding: 12px 7px;
  border-right: 1px solid rgba(247, 245, 251, 0.12);
}

.agent-console__points div:first-child {
  padding-left: 0;
}

.agent-console__points div:last-child {
  padding-right: 0;
  border-right: 0;
}

.agent-console dt {
  color: rgba(247, 245, 251, 0.58);
  font-size: 10px;
  line-height: 1.3;
}

.agent-console dd {
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--console-gold);
  font-family: var(--adv-font-mono);
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
}

.agent-console__tape {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  height: 4px;
  margin-top: 2px;
}

.agent-console__tape-cell {
  background: rgba(247, 245, 251, 0.14);
}

.agent-console__tape-cell--done {
  background: var(--console-gold);
}

.agent-console__tape-cell--current {
  animation: tape-signal 1.4s ease-in-out infinite;
}

.agent-console__stages {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin: 8px 0 16px;
  padding: 0;
  list-style: none;
}

.agent-console__stages li {
  min-width: 0;
  color: rgba(247, 245, 251, 0.38);
}

.agent-console__stages span {
  display: block;
  font-family: var(--adv-font-mono);
  font-size: 9px;
}

.agent-console__stages small {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-console__stage--done,
.agent-console__stage--current {
  color: var(--console-paper) !important;
}

.agent-console__task-card {
  padding: 14px;
  border: 1px solid rgba(212, 168, 83, 0.35);
  border-left: 3px solid var(--console-purple);
  background: rgba(247, 245, 251, 0.045);
}

.agent-console__status,
.agent-console__connection {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--adv-font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.agent-console__status[data-tone='success'] {
  color: var(--console-mint);
}

.agent-console__status[data-tone='alert'] {
  color: var(--console-red);
}

.agent-console__connection {
  color: var(--console-mint);
}

.agent-console__capability {
  margin: 13px 0 5px;
  color: var(--console-gold);
  font-size: 12px;
  font-weight: 700;
}

.agent-console__stream {
  display: -webkit-box;
  overflow: hidden;
  margin: 6px 0 0;
  color: rgba(247, 245, 251, 0.86);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 7;
}

.agent-console__empty,
.agent-console__notice p,
.agent-console__error p,
.agent-console__billing-note,
.agent-console__concurrency-note {
  margin: 6px 0 0;
  color: rgba(247, 245, 251, 0.58);
  font-size: 11px;
  line-height: 1.5;
}

.agent-console__cost-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin: 14px 0 0;
  padding-top: 10px;
  border-top: 1px dashed rgba(247, 245, 251, 0.16);
}

.agent-console__notice,
.agent-console__error {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  padding: 12px;
  border: 1px solid rgba(212, 168, 83, 0.28);
  background: rgba(212, 168, 83, 0.07);
}

.agent-console__notice > ion-icon,
.agent-console__error > ion-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--console-gold);
}

.agent-console__error {
  display: block;
  border-color: rgba(223, 91, 99, 0.38);
  background: rgba(223, 91, 99, 0.08);
}

.agent-console__error strong {
  color: #ff9298;
  font-size: 12px;
}

.agent-console__text-link {
  display: inline-block;
  margin-top: 10px;
  color: var(--console-gold);
  font-size: 12px;
  font-weight: 700;
}

.agent-console__request {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  width: 100%;
  min-height: 44px;
  margin-top: 10px;
  padding: 7px 8px;
  color: rgba(247, 245, 251, 0.74);
  border: 1px solid rgba(247, 245, 251, 0.13);
  background: transparent;
  font-size: 10px;
  text-align: left;
  cursor: pointer;
}

.agent-console__request:focus-visible,
.agent-console__text-link:focus-visible {
  outline: 2px solid var(--console-gold);
  outline-offset: 3px;
}

.agent-console__request code {
  overflow: hidden;
  padding-inline: 7px;
  font-family: var(--adv-font-mono);
  text-overflow: ellipsis;
}

.agent-console__actions {
  justify-content: flex-start;
  margin-top: 12px;
}

.agent-console__actions :deep(.s-button) {
  min-height: 44px;
}

.agent-console__billing-note {
  margin-top: auto;
  padding-top: 18px;
  color: rgba(247, 245, 251, 0.72);
}

.agent-console__billing-note::before {
  content: '◆';
  margin-right: 6px;
  color: var(--console-gold);
}

.agent-console__concurrency-note {
  color: var(--console-gold);
}

.agent-console__reservation-note {
  margin: -8px 0 14px;
  color: rgba(247, 245, 251, 0.58);
  font-size: 11px;
  line-height: 1.45;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

@keyframes tape-signal {
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .agent-console__tape-cell--current {
    animation: none;
  }
}
</style>
