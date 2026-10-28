import type { CreativeAdoptionJournal, CreativeCandidateEditRequest, CreativeDeliveryRequest, CreativeMediaCandidateRequest, CreativePlaytestReport, CreativeProjectWorkspace, CreativeTeamAvailability, CreativeTeamClient, CreativeTeamDecisionInput, CreativeTeamRun, CreativeTeamRunSummary, CreativeTeamStartRequest } from '@advjs/agent'
import { computeAgentProjectRevision, creativeMediaCanonical, CreativeMilestoneCoordinator, normalizeAgentRuntimeError } from '@advjs/agent'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

export const useCreativeTeamStore = defineStore('creative-team', () => {
  const availability = shallowRef<CreativeTeamAvailability>()
  const runs = shallowRef<readonly CreativeTeamRunSummary[]>([])
  const run = shallowRef<CreativeTeamRun>()
  const loading = shallowRef(false)
  const mutating = shallowRef(false)
  const error = shallowRef<string>()
  const connected = shallowRef(false)
  let connection: { client: CreativeTeamClient, accountId: string, projectId: string } | undefined
  let generation = 0
  let selection = 0
  let refreshing: Promise<void> | undefined

  const canStart = computed(() => Boolean(connected.value && availability.value?.enabled && !mutating.value && !loading.value && !run.value?.milestones?.some(item => item.status === 'prepared')
    && !runs.value.some(item => !['completed', 'cancelled'].includes(item.status))
    && (!run.value || ['completed', 'cancelled'].includes(run.value.status))))
  const needsPolling = computed(() => Boolean(run.value && ['ready', 'running', 'cancel_requested'].includes(run.value.status)))

  function failure(cause: unknown): string {
    const detail = normalizeAgentRuntimeError(cause).detail
    if (detail.code === 'unauthenticated')
      return 'login'
    if (detail.code === 'beta_access_required' || detail.code === 'forbidden')
      return 'access'
    if (detail.code === 'balance_insufficient')
      return 'balance'
    if (detail.code === 'concurrency_limit')
      return 'active'
    if (detail.code === 'protocol_unsupported')
      return 'protocol'
    if (detail.code === 'capability_disabled')
      return 'unavailable'
    if (detail.code === 'conflict' || detail.code === 'invalid_request')
      return 'source'
    return 'connection'
  }
  function update(next: CreativeTeamRun) {
    if (next.accountId !== connection?.accountId || next.plan.projectId !== connection.projectId)
      return
    if (run.value?.id === next.id && run.value.revision > next.revision)
      return
    run.value = next
    runs.value = [{ id: next.id, projectId: next.plan.projectId, goal: next.plan.goal, status: next.status, revision: next.revision, chargedMicroPoints: next.chargedMicroPoints, reservedMicroPoints: next.reservedMicroPoints, updatedAt: next.updatedAt }, ...runs.value.filter(item => item.id !== next.id)].slice(0, 20)
  }
  function disconnect() {
    generation += 1
    selection += 1
    connection = undefined
    refreshing = undefined
    availability.value = undefined
    runs.value = []
    run.value = undefined
    loading.value = false
    mutating.value = false
    connected.value = false
    error.value = undefined
  }
  function configure(next: NonNullable<typeof connection>) {
    disconnect()
    connection = next
    connected.value = true
  }

  async function refresh(): Promise<void> {
    if (!connection)
      return
    if (refreshing)
      return refreshing
    const current = connection
    const epoch = generation
    const selected = selection
    loading.value = true
    const job = (async () => {
      try {
        const status = await current.client.availability()
        if (epoch !== generation)
          return
        availability.value = status
        if (!status.enabled && !status.authoring?.candidateEdits) {
          error.value = undefined
          return
        }
        const items = await current.client.list(current.projectId)
        if (epoch !== generation || selected !== selection)
          return
        runs.value = items
        const runId = run.value?.id ?? items.find(item => !['completed', 'cancelled'].includes(item.status))?.id ?? items[0]?.id
        if (runId) {
          const next = await current.client.get(current.projectId, runId)
          if (epoch !== generation || selected !== selection)
            return
          update(next)
        }
        error.value = undefined
      }
      catch (cause) {
        if (epoch === generation && selected === selection)
          error.value = failure(cause)
      }
      finally {
        if (epoch === generation) {
          loading.value = false
          refreshing = undefined
        }
      }
    })()
    refreshing = job
    return job
  }

  async function open(runId: string): Promise<void> {
    if (!connection || mutating.value)
      return
    const current = connection
    const epoch = generation
    const selected = ++selection
    loading.value = true
    try {
      const next = await current.client.get(current.projectId, runId)
      if (epoch === generation && selected === selection) {
        update(next)
        error.value = undefined
      }
    }
    catch (cause) {
      if (epoch === generation && selected === selection)
        error.value = failure(cause)
    }
    finally {
      if (epoch === generation && selected === selection)
        loading.value = false
    }
  }

  async function mutate(operation: (current: NonNullable<typeof connection>) => Promise<CreativeTeamRun>): Promise<boolean> {
    if (!connection || mutating.value)
      return false
    const current = connection
    const epoch = generation
    ++selection
    mutating.value = true
    error.value = undefined
    try {
      const next = await operation(current)
      if (epoch === generation)
        update(next)
      return epoch === generation
    }
    catch (cause) {
      if (epoch === generation)
        error.value = failure(cause)
      return false
    }
    finally {
      if (epoch === generation)
        mutating.value = false
    }
  }

  async function start(request: CreativeTeamStartRequest): Promise<void> {
    if (!canStart.value || request.project.id !== connection?.projectId)
      return
    const intent = crypto.randomUUID()
    await mutate(current => current.client.start(request, intent))
  }
  async function decide(decision: CreativeTeamDecisionInput, project?: CreativeTeamStartRequest['project']): Promise<void> {
    const runId = run.value?.id
    if (!runId || (project && project.id !== connection?.projectId))
      return
    const intent = crypto.randomUUID()
    await mutate(async (current) => {
      if (project)
        await current.client.refreshFacts(project, runId, crypto.randomUUID())
      // A project/account change during the snapshot update must never authorize a billable decision.
      if (current !== connection)
        throw new Error('Creative scope changed')
      return current.client.decide(current.projectId, runId, decision, intent)
    })
  }
  async function finish(request: CreativeDeliveryRequest, intent: string): Promise<boolean> {
    const runId = run.value?.id
    if (!connection || !runId || !availability.value?.authoring?.delivery || !connection.client.finish || request.project.id !== connection.projectId)
      return false
    return mutate(current => current.client.finish!(current.projectId, runId, request, intent))
  }

  async function refreshFacts(project: CreativeTeamStartRequest['project']): Promise<void> {
    const runId = run.value?.id
    if (!runId || project.id !== connection?.projectId)
      return
    await mutate(current => current.client.refreshFacts(project, runId, crypto.randomUUID()))
  }

  async function editCandidate(request: CreativeCandidateEditRequest, project: CreativeTeamStartRequest['project']): Promise<boolean> {
    const runId = run.value?.id
    const before = connection
    if (!runId || !before || project.id !== before.projectId)
      return false
    const intent = `edit_${(await computeAgentProjectRevision({ request: creativeMediaCanonical({ accountId: before.accountId, projectId: project.id, runId, request }) })).slice(7)}`
    if (before !== connection || run.value?.id !== runId)
      return false
    return mutate(async (current) => {
      await current.client.refreshFacts(project, runId, crypto.randomUUID())
      if (current !== connection)
        throw new Error('Creative scope changed')
      return current.client.editCandidate(current.projectId, runId, request, intent)
    })
  }

  async function registerMediaCandidate(request: CreativeMediaCandidateRequest, intent: string): Promise<CreativeTeamRun | undefined> {
    const runId = run.value?.id
    if (!runId || !connection || request.project.id !== connection.projectId || !availability.value?.authoring?.mediaCandidates || !connection.client.registerMediaCandidate)
      throw new Error('Creative media service unavailable')
    const success = await mutate(current => current.client.registerMediaCandidate!(current.projectId, runId, request, intent))
    return success && run.value?.id === runId ? run.value : undefined
  }

  function milestoneCoordinator(workspace: CreativeProjectWorkspace, journal: CreativeAdoptionJournal, assertCurrent: () => void) {
    const current = connection
    const runId = run.value?.id
    if (!current || !runId)
      throw new Error('Creative service unavailable')
    return new CreativeMilestoneCoordinator({ scope: { accountId: current.accountId, projectId: current.projectId, runId }, client: current.client, workspace, journal, assertCurrent() {
      if (current !== connection || run.value?.id !== runId)
        throw new Error('Creative scope changed')
      assertCurrent()
    } })
  }

  function performMilestone(operation: () => Promise<CreativeTeamRun>): Promise<boolean> {
    return mutate(operation)
  }

  async function recordPlaytest(project: CreativeTeamStartRequest['project'], report: CreativePlaytestReport, intent: string): Promise<boolean> {
    const runId = run.value?.id
    if (!runId || project.id !== connection?.projectId || report.projectId !== project.id || !availability.value?.authoring?.playtestReports)
      return false
    return mutate(current => current.client.recordPlaytest(project, runId, report, intent))
  }

  async function requestPlaytestRepair(decision: Extract<CreativeTeamDecisionInput, { type: 'request-rework' }>, project: CreativeTeamStartRequest['project'], intent: string): Promise<boolean> {
    const runId = run.value?.id
    if (!runId || !decision.playtestRepair || project.id !== connection?.projectId || !availability.value?.enabled || !availability.value.authoring?.playtestRepair)
      return false
    return mutate(async (current) => {
      await current.client.refreshFacts(project, runId, `${intent}:facts`)
      if (current !== connection || run.value?.id !== runId)
        throw new Error('Creative scope changed')
      return current.client.decide(current.projectId, runId, decision, intent)
    })
  }

  async function getPlaytest(reportId: string): Promise<CreativePlaytestReport | undefined> {
    const current = connection
    const runId = run.value?.id
    const epoch = generation
    if (!current || !runId)
      return undefined
    const report = await current.client.getPlaytest(current.projectId, runId, reportId)
    return epoch === generation && run.value?.id === runId ? report : undefined
  }

  return { availability, runs, run, loading, mutating, error, connected, canStart, needsPolling, configure, disconnect, refresh, open, start, decide, finish, refreshFacts, editCandidate, registerMediaCandidate, milestoneCoordinator, performMilestone, recordPlaytest, getPlaytest, requestPlaytestRepair }
})
