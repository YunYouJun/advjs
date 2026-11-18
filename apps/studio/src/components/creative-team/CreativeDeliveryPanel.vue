<script setup lang="ts">
import type { CreativeDeliveryDisposition, CreativeDeliveryRequest, CreativePlaytestReport, CreativeProjectWorkspace, CreativeTeamRun } from '@advjs/agent'
import type { CreativeDeliveryIntent } from '../../utils/creativeDeliveryCache'
import type { IFileSystem } from '../../utils/fs'
import { creativeDeliveryPendingMedia, parseCreativeProject } from '@advjs/agent'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCreativeTeamStore } from '../../stores/useCreativeTeamStore'
import { verifyStudioCreativeDelivery } from '../../utils/creativeDelivery'
import { creativeDeliveryCache } from '../../utils/creativeDeliveryCache'
import { runStudioProjectWrite } from '../../utils/projectAudio'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ run: CreativeTeamRun, enabled: boolean, busy: boolean, workspace: () => Promise<CreativeProjectWorkspace>, host: () => Promise<{ fs: IFileSystem, assertCurrent: () => void }> }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const { t } = useI18n()
const store = useCreativeTeamStore()
const rows = ref<CreativeDeliveryDisposition[]>([])
const reason = shallowRef('')
const acknowledged = shallowRef(false)
const working = shallowRef(false)
const initializing = shallowRef(true)
const error = shallowRef(false)
const reviewed = shallowRef<CreativeDeliveryRequest>()
const pending = shallowRef<CreativeDeliveryIntent>()
const scope = { accountId: props.run.accountId, projectId: props.run.plan.projectId, runId: props.run.id }
const current = computed(() => props.run.artifacts.filter(item => ['selected', 'adopted'].includes(item.status)))
const ready = computed(() => props.run.tasks.every(item => item.status === 'completed') && !props.run.reservedMicroPoints && !props.run.milestones?.some(item => item.status === 'prepared'))
const disabled = computed(() => props.busy || working.value || initializing.value || !props.enabled)
watch(() => current.value.map(item => `${item.id}:${item.fingerprint}:${item.status}`).join('|'), () => {
  rows.value = current.value.map((item) => {
    const previous = rows.value.find(row => row.artifactId === item.id && row.fingerprint === item.fingerprint)
    const disposition = item.status === 'adopted' ? 'adopted' : previous && previous.disposition !== 'adopted' ? previous.disposition : item.changes.length ? 'excluded' : 'reference'
    return { artifactId: item.id, fingerprint: item.fingerprint, disposition, reason: previous?.reason ?? '' }
  })
}, { immediate: true })
watch([rows, reason, acknowledged, () => props.run.revision], () => reviewed.value = undefined, { deep: true })
watch(working, value => emit('busy', value))
onBeforeUnmount(() => emit('busy', false))
void creativeDeliveryCache.load(scope).then(async (value) => {
  if (value && props.run.delivery?.id === value.id)
    await creativeDeliveryCache.discard(scope)
  else
    pending.value = value
}).catch(() => error.value = true).finally(() => initializing.value = false)
async function perform(operation: () => Promise<void>) {
  if (disabled.value)
    return
  working.value = true
  error.value = false
  try {
    const host = await props.host()
    await runStudioProjectWrite(host.fs, async () => {
      host.assertCurrent()
      await operation()
      host.assertCurrent()
    })
  }
  catch {
    error.value = true
  }
  finally {
    working.value = false
  }
}
async function verify(workspace: CreativeProjectWorkspace, run: CreativeTeamRun, request: CreativeDeliveryRequest) {
  const reports: CreativePlaytestReport[] = []
  if (request.dispositions.some(item => item.disposition === 'reference' && run.artifacts.find(artifact => artifact.id === item.artifactId)?.output?.kind === 'playtest-plan')) {
    for (const summary of run.playtests?.filter(item => item.scope === 'saved' && item.snapshotRevision === request.project.revision) ?? []) {
      const report = await store.getPlaytest(summary.id)
      if (!report)
        throw new Error('CREATIVE_DELIVERY_PLAYTEST_REQUIRED')
      reports.push(report)
    }
  }
  await verifyStudioCreativeDelivery(workspace, run, request, undefined, reports)
}
async function review() {
  await perform(async () => {
    const workspace = await props.workspace()
    const snapshot = await workspace.snapshot()
    const project = parseCreativeProject({ id: snapshot.projectId, revision: snapshot.revision, files: snapshot.files })
    await store.refreshFacts(project)
    await nextTick()
    const run = store.run
    if (!run || run.id !== scope.runId || run.accountId !== scope.accountId || !acknowledged.value)
      throw new Error('CREATIVE_DELIVERY_CONFLICT')
    const request: CreativeDeliveryRequest = { project, runRevision: run.revision, reason: reason.value, dispositions: structuredClone(rows.value.map(item => ({ ...item }))), acknowledgeUnverified: true }
    await verify(workspace, run, request)
    reviewed.value = request
  })
}
async function finish() {
  await perform(async () => {
    // Read first after a lost response: a historical receipt remains readable after later project edits.
    if (pending.value) {
      await store.open(scope.runId)
      if (store.error)
        throw new Error('CREATIVE_DELIVERY_CONFLICT')
      if (store.run?.delivery?.id === pending.value.id) {
        await creativeDeliveryCache.discard(scope)
        pending.value = undefined
        return
      }
    }
    const request = pending.value?.request ?? reviewed.value
    const run = store.run
    if (!request || !run || run.id !== scope.runId || run.accountId !== scope.accountId)
      throw new Error('CREATIVE_DELIVERY_CONFLICT')
    await verify(await props.workspace(), run, request)
    const intent = pending.value ?? { ...scope, id: crypto.randomUUID(), request }
    await creativeDeliveryCache.save(intent)
    pending.value = intent
    if (!await store.finish(intent.request, intent.id))
      throw new Error('CREATIVE_DELIVERY_CONFLICT')
    await creativeDeliveryCache.discard(scope)
    pending.value = undefined
    reviewed.value = undefined
  })
}
async function reconsider() {
  await perform(async () => {
    await store.open(scope.runId)
    if (store.error)
      throw new Error('CREATIVE_DELIVERY_CONFLICT')
    await creativeDeliveryCache.discard(scope)
    pending.value = undefined
    reviewed.value = undefined
  })
}
const receipt = computed(() => props.run.delivery)
const preview = computed(() => reviewed.value && reviewed.value.runRevision === props.run.revision ? { chargedMicroPoints: props.run.chargedMicroPoints, toolCalls: props.run.toolCalls, playtestIds: props.run.playtests?.filter(item => item.scope === 'saved' && item.snapshotRevision === reviewed.value!.project.revision).map(item => item.id) ?? [], pendingMedia: creativeDeliveryPendingMedia(props.run, reviewed.value.project.files) } : undefined)
</script>

<template>
  <section v-if="enabled || receipt" class="delivery" data-testid="creative-delivery" aria-labelledby="creative-delivery-title">
    <h2 id="creative-delivery-title">
      {{ t('creativeTeam.delivery.title') }}
    </h2>
    <p>{{ t('creativeTeam.delivery.hint') }}</p>
    <p v-if="receipt" role="status">
      {{ t('creativeTeam.delivery.finished') }}
    </p>
    <p v-else-if="!ready">
      {{ t('creativeTeam.delivery.pending') }}
    </p>
    <p v-if="error" role="alert">
      {{ t('creativeTeam.delivery.error') }}
    </p>
    <template v-if="receipt">
      <p class="delivery__note">
        {{ receipt.reason }}
      </p>
      <p class="delivery__revision">
        {{ t('creativeTeam.delivery.revision') }} {{ receipt.projectRevision }}
      </p>
      <ul class="delivery__results">
        <li v-for="row in receipt.dispositions" :key="row.artifactId">
          <strong>{{ run.artifacts.find(item => item.id === row.artifactId)?.summary }}</strong>
          <span>{{ t(`creativeTeam.delivery.${row.disposition}`) }}</span>
          <p class="delivery__note">
            {{ row.reason }}
          </p>
        </li>
      </ul>
      <p>{{ t('creativeTeam.delivery.mediaPending', { count: receipt.pendingMedia.length }) }}</p>
      <ul v-if="receipt.pendingMedia.length">
        <li v-for="item in receipt.pendingMedia" :key="`${item.artifactId}:${item.target}`">
          {{ item.target }}
        </li>
      </ul>
      <ul>
        <li v-for="id in receipt.playtestIds" :key="id">
          {{ t('creativeTeam.delivery.playtestResult', { ...run.playtests?.find(item => item.id === id) }) }}
        </li>
      </ul>
      <p>{{ t('creativeTeam.delivery.totals', { points: receipt.chargedMicroPoints, calls: receipt.toolCalls, reports: receipt.playtestIds.length }) }}</p>
    </template>
    <template v-else-if="pending">
      <p>{{ t('creativeTeam.delivery.retryHint') }}</p>
      <SButton size="lg" :disabled="disabled" @click="finish">
        {{ t('creativeTeam.delivery.retry') }}
      </SButton>
      <SButton size="lg" variant="outline" :disabled="disabled" @click="reconsider">
        {{ t('creativeTeam.delivery.reconsider') }}
      </SButton>
    </template>
    <form v-else-if="ready && !['completed', 'cancelled', 'cancel_requested'].includes(run.status)" @submit.prevent="review">
      <fieldset :disabled="disabled">
        <div v-for="row in rows" :key="row.artifactId" class="delivery__row">
          <p>{{ run.artifacts.find(item => item.id === row.artifactId)?.summary }}</p>
          <label>{{ t('creativeTeam.delivery.disposition') }}
            <select v-model="row.disposition" required>
              <option v-if="run.artifacts.find(item => item.id === row.artifactId)?.status === 'adopted'" value="adopted">{{ t('creativeTeam.delivery.adopted') }}</option>
              <template v-else>
                <option v-if="!run.artifacts.find(item => item.id === row.artifactId)?.changes.length" value="reference">{{ t('creativeTeam.delivery.reference') }}</option>
                <option value="excluded">{{ t('creativeTeam.delivery.excluded') }}</option>
              </template>
            </select>
          </label>
          <label>{{ t('creativeTeam.delivery.itemReason') }}<textarea v-model="row.reason" rows="2" maxlength="4000" required /></label>
        </div>
        <label>{{ t('creativeTeam.delivery.reason') }}<textarea v-model="reason" rows="2" maxlength="4000" required /></label>
        <label class="delivery__ack"><input v-model="acknowledged" type="checkbox" required>{{ t('creativeTeam.delivery.acknowledge') }}</label>
        <SButton type="submit" size="lg" variant="outline">
          {{ t('creativeTeam.delivery.review') }}
        </SButton>
      </fieldset>
      <template v-if="preview">
        <p role="status">
          {{ t('creativeTeam.delivery.reviewed') }}
        </p>
        <p>{{ t('creativeTeam.delivery.mediaPending', { count: preview.pendingMedia.length }) }}</p>
        <p>{{ t('creativeTeam.delivery.totals', { points: preview.chargedMicroPoints, calls: preview.toolCalls, reports: preview.playtestIds.length }) }}</p>
        <SButton size="lg" :disabled="disabled" :loading="working" @click="finish">
          {{ t('creativeTeam.delivery.finish') }}
        </SButton>
      </template>
    </form>
    <p>{{ t('creativeTeam.delivery.unverified') }}</p>
  </section>
</template>

<style scoped>
.delivery {
  min-width: 0;
  margin-top: var(--adv-space-lg);
  line-height: 1.6;
}
.delivery h2 {
  font-size: var(--adv-font-title);
}
.delivery p {
  margin-block: var(--adv-space-sm);
}
.delivery__results {
  display: grid;
  gap: var(--adv-space-md);
  padding: 0;
  margin-block: var(--adv-space-lg);
  list-style: none;
}
.delivery__results li {
  padding-bottom: var(--adv-space-md);
  border-bottom: 1px solid var(--adv-border-subtle);
}
.delivery__results strong,
.delivery__results span {
  display: block;
}
.delivery__results span {
  color: var(--adv-text-secondary);
}
.delivery__note {
  white-space: pre-wrap;
}
.delivery fieldset {
  padding: 0;
  border: 0;
  min-width: 0;
}
.delivery label {
  display: grid;
  gap: var(--adv-space-sm);
  margin-block: var(--adv-space-md);
}
.delivery__row {
  border-top: 1px solid var(--adv-border-subtle);
  padding-block: var(--adv-space-sm);
}
.delivery select,
.delivery textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-page);
  color: var(--adv-text-primary);
  font: inherit;
}
.delivery select:focus-visible,
.delivery textarea:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.delivery .delivery__ack {
  display: flex;
  align-items: center;
  min-height: 44px;
}
.delivery__ack input {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
}
.delivery__revision,
.delivery li {
  overflow-wrap: anywhere;
}
</style>
