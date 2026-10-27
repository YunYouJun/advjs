<script setup lang="ts">
import type { CreativeAdoptionRecovery, CreativeMilestoneRequest, CreativeMilestoneReview, CreativeProjectWorkspace, CreativeTeamRun } from '@advjs/agent'
import { reviewCreativeMilestone } from '@advjs/agent'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCreativeTeamStore } from '../../stores/useCreativeTeamStore'
import { creativeAdoptionJournal } from '../../utils/creativeAdoptionJournal'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ run: CreativeTeamRun, enabled: boolean, busy: boolean, workspace: () => Promise<CreativeProjectWorkspace> }>()
const emit = defineEmits<{ busy: [value: boolean], changed: [] }>()
const { t } = useI18n()
const store = useCreativeTeamStore()
const selected = shallowRef<string[]>([])
const reason = shallowRef('')
const working = shallowRef(false)
const failure = shallowRef(false)
const recovery = shallowRef<CreativeAdoptionRecovery>()
const reviewed = shallowRef<{ request: CreativeMilestoneRequest, review: CreativeMilestoneReview }>()
const candidates = computed(() => props.run.artifacts.filter(item => item.status === 'selected' && item.changes.length))
const pending = computed(() => props.run.milestones?.find(item => item.status === 'prepared'))
const unresolved = computed(() => recovery.value && !['confirmed', 'abandoned'].includes(recovery.value.entry.state))
const active = computed(() => props.run.tasks.some(task => ['running', 'reconcile_required'].includes(task.status)))
const latest = computed(() => props.run.milestones?.filter(item => item.status === 'confirmed').at(-1))
let epoch = 0

function select(id: string, checked: boolean) {
  selected.value = checked ? [...selected.value, id] : selected.value.filter(item => item !== id)
  reviewed.value = undefined
}
async function coordinator() {
  const identity = [props.run.accountId, props.run.plan.projectId, props.run.id].join(':')
  const workspace = await props.workspace()
  return store.milestoneCoordinator(workspace, creativeAdoptionJournal, () => {
    if ([props.run.accountId, props.run.plan.projectId, props.run.id].join(':') !== identity)
      throw new Error('Creative milestone scope changed')
  })
}
async function inspect() {
  const turn = ++epoch
  try {
    const current = await coordinator()
    const next = await current.recover()
    if (turn === epoch)
      recovery.value = next
  }
  catch {
    if (turn === epoch)
      failure.value = true
  }
}
watch([() => props.run.id, () => props.run.accountId, () => props.run.plan.projectId], () => {
  reviewed.value = undefined
  selected.value = []
  reason.value = ''
  recovery.value = undefined
  failure.value = false
  void inspect()
}, { immediate: true })
watch(() => props.run.revision, () => {
  if (!working.value)
    reviewed.value = undefined
})
watch(reason, () => reviewed.value = undefined)

async function work(action: () => Promise<void>) {
  if (working.value || props.busy)
    return
  working.value = true
  emit('busy', true)
  failure.value = false
  try {
    await action()
  }
  catch {
    failure.value = true
  }
  finally {
    working.value = false
    emit('busy', false)
  }
}
async function review(operation: 'adopt' | 'undo') {
  await work(async () => {
    const run = props.run
    const snapshot = await (await props.workspace()).snapshot()
    const project = { id: snapshot.projectId, revision: snapshot.revision, files: snapshot.files }
    const request: CreativeMilestoneRequest = operation === 'adopt'
      ? { operation, project, reason: reason.value, artifacts: candidates.value.filter(item => selected.value.includes(item.id)).map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })) }
      : { operation, project, reason: reason.value, milestoneId: latest.value!.id }
    const result = await reviewCreativeMilestone(run, request)
    if (props.run.id !== run.id || props.run.revision !== run.revision)
      throw new Error('Creative review changed')
    reviewed.value = { request, review: result }
  })
}
async function apply() {
  const value = reviewed.value
  if (!value)
    return
  await work(async () => {
    const current = await coordinator()
    const success = await store.performMilestone(() => current.begin(props.run, value.request, value.review))
    if (success) {
      reviewed.value = undefined
      selected.value = []
      emit('changed')
    }
    else {
      failure.value = true
    }
    await inspect()
  })
}
async function resolve(operation: 'resume' | 'abandon') {
  const entry = recovery.value?.entry
  if (!entry)
    return
  await work(async () => {
    const current = await coordinator()
    if (await store.performMilestone(() => current[operation](entry))) {
      reviewed.value = undefined
      emit('changed')
    }
    else {
      failure.value = true
    }
    await inspect()
  })
}
</script>

<template>
  <section v-if="enabled || pending || recovery" class="milestone" data-testid="creative-milestone">
    <h2>{{ t('creativeTeam.milestone.title') }}</h2>
    <p>{{ t('creativeTeam.milestone.hint') }}</p>
    <p v-if="failure" role="alert">
      {{ t('creativeTeam.milestone.failure') }}
    </p>
    <div v-if="unresolved" class="milestone__recovery" role="status">
      <p>{{ t(`creativeTeam.milestone.recovery.${recovery!.projectState}`) }}</p>
      <SButton v-if="recovery!.projectState !== 'conflict'" size="lg" :disabled="busy || working" @click="resolve('resume')">
        {{ t(recovery!.projectState === 'after' ? 'creativeTeam.milestone.confirmReceipt' : 'creativeTeam.milestone.resume') }}
      </SButton>
      <SButton v-if="recovery!.projectState === 'before'" variant="outline" size="lg" :disabled="busy || working" @click="resolve('abandon')">
        {{ t('creativeTeam.milestone.abandon') }}
      </SButton>
    </div>
    <p v-else-if="pending" role="status">
      {{ t('creativeTeam.milestone.otherDevice') }}
    </p>
    <template v-else-if="enabled">
      <p v-if="active" role="status">
        {{ t('creativeTeam.milestone.wait') }}
      </p>
      <fieldset v-if="candidates.length" :disabled="busy || working || active">
        <legend>{{ t('creativeTeam.milestone.choose') }}</legend>
        <label v-for="artifact in candidates" :key="artifact.id" class="milestone__selection">
          <input type="checkbox" :checked="selected.includes(artifact.id)" @change="select(artifact.id, ($event.target as HTMLInputElement).checked)">
          <span>{{ artifact.summary }}</span>
        </label>
      </fieldset>
      <label v-if="candidates.length || latest?.operation === 'adopt'" class="milestone__reason">
        {{ t('creativeTeam.milestone.reason') }}
        <textarea v-model="reason" rows="2" maxlength="4000" :disabled="busy || working" />
      </label>
      <div class="milestone__actions">
        <SButton v-if="candidates.length" variant="outline" size="lg" :disabled="busy || working || active || !selected.length || !reason.trim()" @click="review('adopt')">
          {{ t('creativeTeam.milestone.review') }}
        </SButton>
        <SButton v-if="latest?.operation === 'adopt'" variant="outline" size="lg" :disabled="busy || working || active || !reason.trim()" @click="review('undo')">
          {{ t('creativeTeam.milestone.reviewUndo') }}
        </SButton>
      </div>
      <div v-if="reviewed" class="milestone__review">
        <p>{{ t('creativeTeam.milestone.compiled') }}</p>
        <details v-for="change in reviewed.review.changes" :key="change.path">
          <summary>{{ change.path }}</summary>
          <h3>{{ t('creativeTeam.milestone.before') }}</h3><pre>{{ change.before ?? t('creativeTeam.milestone.absent') }}</pre>
          <h3>{{ t('creativeTeam.milestone.after') }}</h3><pre>{{ change.after ?? t('creativeTeam.milestone.absent') }}</pre>
        </details>
        <SButton size="lg" :disabled="busy || working || active" :loading="working" @click="apply">
          {{ t(reviewed.request.operation === 'undo' ? 'creativeTeam.milestone.confirmUndo' : 'creativeTeam.milestone.confirmWrite') }}
        </SButton>
      </div>
    </template>
    <p v-if="latest && !unresolved">
      {{ t(latest.operation === 'undo' ? 'creativeTeam.milestone.undone' : 'creativeTeam.milestone.adopted') }} · {{ latest.reason }}
    </p>
  </section>
</template>

<style scoped>
.milestone {
  margin-top: var(--adv-space-lg);
  border-top: 1px solid var(--adv-border-subtle);
  padding-top: var(--adv-space-lg);
  line-height: 1.6;
}
.milestone h2 {
  font-size: var(--adv-font-title);
}
.milestone fieldset {
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  min-width: 0;
}
.milestone__selection {
  display: flex;
  gap: var(--adv-space-sm);
  align-items: center;
  min-height: 44px;
  overflow-wrap: anywhere;
}
.milestone__selection input {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: var(--adv-primary);
}
.milestone__reason {
  display: grid;
  gap: var(--adv-space-sm);
  margin-block: var(--adv-space-md);
}
.milestone textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 72px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-page);
  color: var(--adv-text-primary);
  padding: var(--adv-space-sm);
  font: inherit;
}
.milestone :is(input, textarea, summary):focus-visible {
  outline: 3px solid var(--adv-primary-soft);
  outline-offset: 2px;
}
.milestone__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-sm);
}
.milestone__review,
.milestone__recovery {
  margin-top: var(--adv-space-md);
  padding: var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-elevated);
}
.milestone summary {
  min-height: 44px;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.milestone pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 360px;
  overflow-y: auto;
  font-size: var(--adv-font-body-sm);
}
.milestone [role='alert'] {
  color: var(--adv-danger);
}
</style>
