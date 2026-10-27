<script setup lang="ts">
import type { CreativeCandidateEditRequest, CreativePartnerId, CreativeTeamDecisionInput } from '@advjs/agent'
import type { CreativeMediaSubmit } from '../../utils/creativeMediaCandidate'
import { CREATIVE_PARTNER_DEFAULT_CAPABILITY, parseCreativeProject } from '@advjs/agent'
import { storeToRefs } from 'pinia'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useProjectContent } from '../../composables/useProjectContent'
import { useAuthStore } from '../../stores/useAuthStore'
import { useCreativeTeamStore } from '../../stores/useCreativeTeamStore'
import { useManagedAgentStore } from '../../stores/useManagedAgentStore'
import { useStudioStore } from '../../stores/useStudioStore'
import { createStudioCreativeMediaWorkspace } from '../../utils/creativeMediaMilestoneWorkspace'
import { createStudioCreativeWorkspace } from '../../utils/creativeTeamWorkspace'
import SButton from '../ui/SButton.vue'
import CreativeArtImportPanel from './CreativeArtImportPanel.vue'
import CreativeMilestonePanel from './CreativeMilestonePanel.vue'
import CreativePartnerRoster from './CreativePartnerRoster.vue'
import CreativePlaytestPanel from './CreativePlaytestPanel.vue'
import CreativeTeamRequestForm from './CreativeTeamRequestForm.vue'
import CreativeTeamRunPanel from './CreativeTeamRunPanel.vue'
import CreativeVoiceImportPanel from './CreativeVoiceImportPanel.vue'

const props = withDefaults(defineProps<{ initialPartner?: CreativePartnerId }>(), { initialPartner: 'director' })
const { t, locale } = useI18n()
const router = useRouter()
const studio = useStudioStore()
const auth = useAuthStore()
const managed = useManagedAgentStore()
const store = useCreativeTeamStore()
const content = useProjectContent()
const { availability, run, runs, loading, mutating, error, connected, canStart } = storeToRefs(store)
const partner = shallowRef<CreativePartnerId>(props.initialPartner)
const workspaceRoot = useTemplateRef<HTMLElement>('workspaceRoot')
const savedEditArtifactId = shallowRef<string>()
const snapshotError = shallowRef(false)
const preparing = shallowRef(false)
const milestoneBusy = shallowRef(false)
const playtestBusy = shallowRef(false)
const artBusy = shallowRef(false)
const voiceBusy = shallowRef(false)
const partnerEnabled = computed(() => availability.value?.capabilities.includes(CREATIVE_PARTNER_DEFAULT_CAPABILITY[partner.value]))
const knownCharacterIds = computed(() => content.characters.value.map(character => character.id))
watch(() => studio.currentProjectId, () => {
  snapshotError.value = false
  savedEditArtifactId.value = undefined
})

async function projectHost() {
  const projectId = studio.currentProject?.projectId
  const accountId = auth.userId
  if (!projectId)
    throw new Error('Project required')
  const assertCurrent = () => {
    if (studio.currentProject?.projectId !== projectId || auth.userId !== accountId)
      throw new Error('Creative project changed')
  }
  await content.whenReady()
  assertCurrent()
  const fs = content.getFs()
  if (!fs)
    throw new Error('Project filesystem unavailable')
  return { fs, projectId, assertCurrent }
}
async function projectWorkspace() {
  const { fs, projectId, assertCurrent } = await projectHost()
  const current = store.run
  if (availability.value?.authoring?.mediaCandidates && current && current.plan.projectId === projectId) {
    const scope = { accountId: current.accountId, projectId, runId: current.id }
    return createStudioCreativeMediaWorkspace({ fs, scope, run: () => store.run!, assertCurrent() {
      assertCurrent()
      if (store.run?.id !== scope.runId || store.run.accountId !== scope.accountId)
        throw new Error('Creative run changed')
    } })
  }
  return createStudioCreativeWorkspace(fs, projectId, { assertCurrent })
}
const submitMedia: CreativeMediaSubmit = async (request, intent) => {
  const next = await store.registerMediaCandidate(request, intent)
  if (!next)
    throw new Error('Creative media candidate registration failed')
  return next
}
async function projectSnapshot() {
  const snapshot = await (await projectWorkspace()).snapshot()
  const projectId = snapshot.projectId
  return parseCreativeProject({ id: projectId, revision: snapshot.revision, files: snapshot.files })
}
async function withSnapshot(action: (project: Awaited<ReturnType<typeof projectSnapshot>>) => Promise<void>) {
  if (preparing.value || mutating.value || milestoneBusy.value || playtestBusy.value || artBusy.value || voiceBusy.value)
    return
  preparing.value = true
  snapshotError.value = false
  try {
    await action(await projectSnapshot())
  }
  catch {
    snapshotError.value = true
  }
  finally {
    preparing.value = false
  }
}
async function start(value: { goal: string, maxMicroPoints: number }) {
  await withSnapshot(project => store.start({
    protocolVersion: 1,
    project,
    goal: value.goal,
    partner: partner.value,
    locale: locale.value,
    limits: { maxTasks: 12, maxToolCalls: 64, maxReworkRounds: 2, maxMicroPoints: value.maxMicroPoints },
  }))
}
async function decide(decision: CreativeTeamDecisionInput) {
  if (decision.type === 'cancel') {
    await store.decide(decision)
    return
  }
  await withSnapshot(project => store.decide(decision, project))
}
async function editCandidate(request: CreativeCandidateEditRequest) {
  await withSnapshot(async (project) => {
    if (await store.editCandidate(request, project)) {
      savedEditArtifactId.value = request.artifactId
      const edited = store.run?.artifacts.findLast(item => item.editedFrom?.artifactId === request.artifactId)
      await nextTick()
      if (edited)
        workspaceRoot.value?.querySelector<HTMLElement>(`[data-creative-artifact="${CSS.escape(edited.id)}"] h3`)?.focus()
    }
  })
}
</script>

<template>
  <div ref="workspaceRoot" class="team-workspace">
    <header class="team-workspace__header">
      <div>
        <p class="team-workspace__eyebrow">
          {{ t('creativeTeam.experimental') }}
        </p>
        <h1 class="team-workspace__title">
          {{ studio.currentProject?.name || t('creativeTeam.title') }}
        </h1>
      </div>
      <SButton variant="outline" size="lg" :disabled="!connected || mutating || milestoneBusy || playtestBusy || artBusy || voiceBusy" :loading="loading" @click="store.refresh">
        {{ t('creativeTeam.refresh') }}
      </SButton>
    </header>
    <p v-if="!studio.currentProject" class="team-workspace__notice">
      {{ t('creativeTeam.noProject') }}
    </p>
    <p v-else-if="!auth.isLoggedIn" class="team-workspace__notice">
      {{ t('creativeTeam.login') }}
    </p>
    <p v-else-if="!connected" class="team-workspace__notice">
      {{ t('creativeTeam.noService') }}
    </p>
    <p v-else-if="availability && !availability.enabled" class="team-workspace__notice" role="status">
      {{ t(availability.authoring?.candidateEdits ? 'creativeTeam.generationDisabled' : 'creativeTeam.disabled') }}
    </p>
    <p v-if="error" class="team-workspace__error" role="alert">
      {{ t(`creativeTeam.error.${error}`) }}
    </p>
    <p v-if="snapshotError" class="team-workspace__error" role="alert">
      {{ t('creativeTeam.snapshotError') }}
    </p>
    <p v-if="loading && !availability" role="status">
      {{ t('creativeTeam.loading') }}
    </p>

    <CreativePartnerRoster :selected="partner" :availability="availability" :run="run" @select="partner = $event" />
    <div v-if="studio.currentProject" class="team-workspace__body">
      <section v-if="!run || ['cancelled', 'completed'].includes(run.status)" class="team-workspace__section">
        <p v-if="managed.hasActiveTask" class="team-workspace__notice">
          {{ t('creativeTeam.oldTask') }}
        </p>
        <CreativeTeamRequestForm :partner="partner" :disabled="!canStart || !partnerEnabled || managed.hasActiveTask || milestoneBusy || playtestBusy || artBusy || voiceBusy" :busy="mutating || preparing || milestoneBusy || playtestBusy || artBusy || voiceBusy" @submit="start" />
      </section>
      <div class="team-workspace__section">
        <label v-if="runs.length" class="team-workspace__history">
          {{ t('creativeTeam.history') }}
          <select :value="run?.id" :disabled="mutating || preparing || loading || milestoneBusy || playtestBusy || artBusy || voiceBusy" @change="store.open(($event.target as HTMLSelectElement).value)">
            <option v-for="item in runs" :key="item.id" :value="item.id">{{ t(`creativeTeam.status.${item.status}`) }} · {{ item.goal }}</option>
          </select>
        </label>
        <p v-else-if="!loading">
          {{ t('creativeTeam.noRuns') }}
        </p>
        <CreativeTeamRunPanel v-if="run" :run="run" :busy="mutating || preparing || milestoneBusy || playtestBusy || artBusy || voiceBusy || Boolean(run.milestones?.some(item => item.status === 'prepared'))" :enabled="Boolean(availability?.enabled)" :known-character-ids="knownCharacterIds" :author-edits-available="Boolean(availability?.authoring?.candidateEdits)" :saved-edit-artifact-id="savedEditArtifactId" @decide="decide" @sync-facts="withSnapshot(store.refreshFacts)" @edit="editCandidate" />
        <CreativeMilestonePanel v-if="run" :key="`${run.accountId}:${run.plan.projectId}:${run.id}`" :run="run" :enabled="Boolean(availability?.authoring?.milestoneAdoption)" :busy="mutating || preparing || playtestBusy || artBusy || voiceBusy" :workspace="projectWorkspace" @busy="milestoneBusy = $event" @changed="content.reload()" />
        <CreativeArtImportPanel v-if="run" :key="`art:${run.accountId}:${run.plan.projectId}:${run.id}`" :run="run" :busy="mutating || preparing || milestoneBusy || playtestBusy || voiceBusy" :host="projectHost" :submit-media="availability?.authoring?.mediaCandidates ? submitMedia : undefined" @busy="artBusy = $event" @changed="content.reload()" />
        <CreativeVoiceImportPanel v-if="run" :key="`voice:${run.accountId}:${run.plan.projectId}:${run.id}`" :run="run" :busy="mutating || preparing || milestoneBusy || playtestBusy || artBusy" :host="projectHost" :submit-media="availability?.authoring?.mediaCandidates ? submitMedia : undefined" @busy="voiceBusy = $event" @changed="content.reload()" />
        <CreativePlaytestPanel v-if="run" :key="`playtest:${run.accountId}:${run.plan.projectId}:${run.id}`" :run="run" :busy="mutating || preparing || milestoneBusy || artBusy || voiceBusy" :workspace="projectWorkspace" @busy="playtestBusy = $event" @source="(path, line) => router.push({ path: '/editor', query: { file: path, line: String(line || 1), column: '1' } })" />
      </div>
    </div>
    <footer class="team-workspace__footer">
      <div class="team-workspace__links">
        <RouterLink to="/editor">
          {{ t('creativeTeam.editor') }}
        </RouterLink><RouterLink to="/tabs/play">
          {{ t('creativeTeam.play') }}
        </RouterLink>
      </div>
      <p>{{ t('creativeTeam.savedPlayHint') }}</p>
      <p v-if="availability">
        {{ t('creativeTeam.service') }} · {{ availability.serviceVersion }}
      </p>
    </footer>
  </div>
</template>

<style scoped>
.team-workspace {
  box-sizing: border-box;
  max-width: 1040px;
  padding: var(--adv-space-lg);
  margin: 0 auto;
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body);
}
.team-workspace__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-md);
  margin-bottom: var(--adv-space-lg);
}
.team-workspace__eyebrow {
  color: var(--adv-primary);
  font-size: var(--adv-font-body-sm);
  margin-top: 0;
}
.team-workspace__title {
  font-size: var(--adv-font-display);
  margin: 0;
  overflow-wrap: anywhere;
}
.team-workspace__body {
  display: grid;
  gap: var(--adv-space-lg);
  margin-top: var(--adv-space-lg);
}
.team-workspace__section {
  min-width: 0;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-lg);
  padding: var(--adv-space-lg);
  background: var(--adv-surface-card);
}
.team-workspace__notice {
  background: var(--adv-surface-elevated);
  color: var(--adv-text-secondary);
  padding: var(--adv-space-md);
  border-radius: var(--adv-radius-md);
}
.team-workspace__error {
  color: var(--adv-danger);
  line-height: 1.6;
}
.team-workspace__history {
  display: grid;
  gap: var(--adv-space-sm);
  margin-bottom: var(--adv-space-lg);
}
.team-workspace__history select {
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
.team-workspace__history select:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.team-workspace__footer {
  margin-top: var(--adv-space-lg);
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  line-height: 1.6;
}
.team-workspace__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-md);
}
.team-workspace__links a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}
@media (max-width: 650px) {
  .team-workspace {
    padding: var(--adv-space-md);
  }
  .team-workspace__section {
    padding: var(--adv-space-md);
  }
}
</style>
