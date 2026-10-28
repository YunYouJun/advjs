import type { CreativePlaytestReport, CreativeProjectWorkspace, CreativeTeamClient, CreativeTeamStartRequest } from '@advjs/agent'
import type { CreativePlaytestCacheEntry } from '../utils/creativePlaytestCache'
import { computeAgentProjectRevision, createCreativeBootstrapPlan, createCreativePlaytestVoiceCoverage, createCreativeTeamRun, creativePlaytestFindings, parseCreativeTeamStartRequest } from '@advjs/agent'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef, watch } from 'vue'
import frozen from '../../../../packages/agent/test/fixtures/creative-team/v2/project.json'
import { useCreativePlaytest } from '../composables/useCreativePlaytest'
import { useCreativeTeamStore } from '../stores/useCreativeTeamStore'

beforeEach(() => setActivePinia(createPinia()))
async function fixture(inspectVoiceCoverage?: CreativeProjectWorkspace['inspectVoiceCoverage']) {
  let files: Record<string, string> = structuredClone(frozen.files)
  const snapshot = vi.fn(async () => ({ projectId: 'station', files: { ...files }, revision: await computeAgentProjectRevision(files) }))
  const project = { id: 'station', files, revision: (await snapshot()).revision }
  const request = parseCreativeTeamStartRequest({ protocolVersion: 1, project, partner: 'writer', goal: '两个结局', locale: 'zh-CN', limits: { maxTasks: 4, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 1000 } })
  const run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan: createCreativeBootstrapPlan(request), now: 0 })
  const unavailable = vi.fn(async (): Promise<never> => {
    throw new Error('Unexpected model call')
  })
  const client: CreativeTeamClient = { availability: async () => ({ protocolVersion: 1, enabled: false, serviceVersion: 'test-only', capabilities: [], maxConcurrentTasks: 1, authoring: { candidateEdits: true, milestoneAdoption: true, playtestReports: true }, media: { image: 'unavailable', voice: 'unavailable' } }), list: async () => [], get: async () => structuredClone(run), start: unavailable, decide: vi.fn(async () => unavailable()), refreshFacts: vi.fn(async () => unavailable()), editCandidate: unavailable, milestone: unavailable, recordPlaytest: vi.fn(async (_project: CreativeTeamStartRequest['project'], _runId: string, report: CreativePlaytestReport, intentId: string) => ({ ...structuredClone(run), revision: 2, playtests: [{ id: 'report1', intentId, projectId: report.projectId, baselineRevision: report.baselineRevision, snapshotRevision: report.snapshotRevision, artifacts: report.artifacts, scope: report.scope, runnerVersion: report.runnerVersion, verification: 'author-host' as const, passed: report.executions.filter(item => item.status === 'passed').length, failed: report.executions.filter(item => item.status === 'failed').length, blocked: report.executions.filter(item => item.status === 'blocked').length, cancelled: 0, createdAt: 1 }] })), getPlaytest: vi.fn() }
  const store = useCreativeTeamStore()
  store.configure({ client, accountId: 'author1', projectId: 'station' })
  await store.refresh()
  await store.open(run.id)
  const current = shallowRef(store.run!)
  const rows = new Map<string, CreativePlaytestCacheEntry>()
  const cache = { list: vi.fn(async (scope: { accountId: string, projectId: string, runId: string }) => [...rows.values()].filter(item => item.accountId === scope.accountId && item.projectId === scope.projectId && item.runId === scope.runId).sort((left, right) => right.report.finishedAt - left.report.finishedAt)), save: vi.fn(async (entry: CreativePlaytestCacheEntry) => {
    rows.set(entry.id, structuredClone(entry))
  }) }
  let session!: ReturnType<typeof useCreativePlaytest>
  function open() {
    const wrapper = mount(defineComponent({ setup() {
      watch(() => store.run, value => value && (current.value = value))
      session = useCreativePlaytest({ run: () => current.value, workspace: async () => ({ snapshot, capabilities: ['candidate-preview'], commit: unavailable, inspectVoiceCoverage }), cache })
      return () => h('div')
    } }))
    return wrapper
  }
  return { store, client, rows, snapshot, cache, current, open, session: () => session, unavailable, breakSource: () => files = { ...files, 'adv/chapters/station.adv.md': '# 车站 {#arrival}\n\n- [坏链接](missing#ending)' }, edit: () => files = { ...files, 'adv/world.md': '作者修改了世界设定。' } }
}
const scenarios = [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }]

describe('creative path execution, persistence and scope', () => {
  it('negotiates host voice evidence explicitly and preserves it through local and service storage', async () => {
    const inspector = vi.fn<NonNullable<CreativeProjectWorkspace['inspectVoiceCoverage']>>(async source => createCreativePlaytestVoiceCoverage({ snapshotRevision: source.revision, locale: 'zh-CN', complete: true, rows: [] }))
    const f = await fixture(inspector)
    const wrapper = f.open()
    await flushPromises()
    await f.session().execute(scenarios, false)
    expect(inspector).not.toHaveBeenCalled()
    expect(f.session().report.value?.voiceCoverage).toBeUndefined()
    const available = await f.client.availability()
    vi.spyOn(f.client, 'availability').mockResolvedValue({ ...available, authoring: { ...available.authoring!, playtestVoiceCoverage: true } })
    await f.store.refresh()
    await f.session().execute(scenarios, false)
    expect(inspector).toHaveBeenCalledTimes(1)
    expect(f.session().report.value?.voiceCoverage?.snapshotRevision).toBe((await f.snapshot()).revision)
    expect(vi.mocked(f.client.recordPlaytest).mock.calls[1]![2].voiceCoverage).toEqual(f.session().report.value?.voiceCoverage)
    const key = f.session().activeEntry.value!.id
    expect(f.rows.get(key)?.report.voiceCoverage).toEqual(f.session().report.value?.voiceCoverage)
    wrapper.unmount()
    const reopened = f.open()
    await flushPromises()
    expect(inspector).toHaveBeenCalledTimes(1)
    expect(f.client.recordPlaytest).toHaveBeenCalledTimes(2)
    expect(f.session().report.value?.voiceCoverage).toBeDefined()
    reopened.unmount()
  })

  it('discards voice results from a project changed during byte inspection', async () => {
    const inspector = vi.fn<NonNullable<CreativeProjectWorkspace['inspectVoiceCoverage']>>()
    const f = await fixture(inspector)
    const available = await f.client.availability()
    vi.spyOn(f.client, 'availability').mockResolvedValue({ ...available, authoring: { ...available.authoring!, playtestVoiceCoverage: true } })
    await f.store.refresh()
    inspector.mockImplementation(async (source) => {
      f.edit()
      return createCreativePlaytestVoiceCoverage({ snapshotRevision: source.revision, locale: 'zh-CN', complete: true, rows: [] })
    })
    const wrapper = f.open()
    await flushPromises()
    await f.session().execute(scenarios, false)
    expect(f.session().report.value).toBeUndefined()
    expect(f.session().error.value).toBe('execution')
    expect(f.rows.size).toBe(0)
    expect(f.client.recordPlaytest).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps an unsynced voice report local when the service no longer advertises that report field', async () => {
    const inspector = vi.fn<NonNullable<CreativeProjectWorkspace['inspectVoiceCoverage']>>(async source => createCreativePlaytestVoiceCoverage({ snapshotRevision: source.revision, locale: 'zh-CN', complete: true, rows: [] }))
    const f = await fixture(inspector)
    const available = await f.client.availability()
    const availability = vi.spyOn(f.client, 'availability').mockResolvedValue({ ...available, authoring: { ...available.authoring!, playtestVoiceCoverage: true } })
    vi.mocked(f.client.recordPlaytest).mockRejectedValueOnce(new Error('offline'))
    await f.store.refresh()
    const wrapper = f.open()
    await flushPromises()
    await f.session().execute(scenarios, false)
    const original = structuredClone(f.session().report.value)
    expect(original?.voiceCoverage).toBeDefined()
    availability.mockResolvedValue(available)
    await f.store.refresh()
    await f.session().sync()
    expect(f.session().error.value).toBe('voice-service')
    expect(f.client.recordPlaytest).toHaveBeenCalledTimes(1)
    expect(f.session().report.value).toEqual(original)
    expect(f.rows.size).toBe(1)
    wrapper.unmount()
  })

  it('keeps actual reports after same-run metadata changes and reopens through reads without running or posting again', async () => {
    const f = await fixture()
    const first = f.open()
    await flushPromises()
    await f.session().execute(scenarios, false)
    expect(f.session().report.value?.executions.map(item => item.status)).toEqual(['passed', 'passed'])
    expect(f.session().activeEntry.value?.synced).toBe(true)
    expect(f.store.run?.revision).toBe(2)
    expect(f.rows.size).toBe(1)
    expect(f.client.recordPlaytest).toHaveBeenCalledTimes(1)
    first.unmount()
    const reopened = f.open()
    await flushPromises()
    expect(f.session().report.value?.executions).toHaveLength(2)
    expect(f.client.recordPlaytest).toHaveBeenCalledTimes(1)
    expect(f.unavailable).not.toHaveBeenCalled()
    f.edit()
    await f.session().checkVersion()
    expect(f.session().stale.value).toBe(true)
    reopened.unmount()
  })

  it('preserves the same report key after an unconfirmed sync and never silently retries on reopen', async () => {
    const f = await fixture()
    vi.mocked(f.client.recordPlaytest).mockRejectedValueOnce(new Error('lost response'))
    const first = f.open()
    await flushPromises()
    await f.session().execute(scenarios, false)
    expect(f.session().error.value).toBe('sync')
    const key = f.session().activeEntry.value?.id
    expect(key).toBeTruthy()
    first.unmount()
    const reopened = f.open()
    await flushPromises()
    expect(f.client.recordPlaytest).toHaveBeenCalledTimes(1)
    await f.session().sync()
    expect(vi.mocked(f.client.recordPlaytest).mock.calls.map(item => item[3])).toEqual([key, key])
    expect(f.session().report.value?.executions.every(item => item.status === 'passed')).toBe(true)
    reopened.unmount()
  })

  it('keeps an execution visible but does not sync or claim persistence after local storage fails', async () => {
    const f = await fixture()
    const wrapper = f.open()
    await flushPromises()
    f.cache.save.mockRejectedValueOnce(new Error('storage failed'))
    await f.session().execute(scenarios, false)
    expect(f.session().report.value?.executions).toHaveLength(2)
    expect(f.session().error.value).toBe('storage')
    expect(f.session().activeEntry.value).toBeUndefined()
    expect(f.client.recordPlaytest).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('links a synced real finding to an explicit repair and reuses its stable intent after an unknown result and reopen', async () => {
    const f = await fixture()
    f.breakSource()
    const available = await f.client.availability()
    vi.spyOn(f.client, 'availability').mockResolvedValue({ ...available, enabled: true, authoring: { ...available.authoring!, playtestRepair: true } })
    vi.mocked(f.client.refreshFacts).mockResolvedValue(f.current.value)
    vi.mocked(f.client.decide).mockRejectedValueOnce(new Error('response lost')).mockResolvedValue(f.current.value)
    await f.store.refresh()
    const first = f.open()
    await flushPromises()
    await f.session().execute(scenarios, false)
    expect(f.session().storedReportId.value).toBe('report1')
    const finding = creativePlaytestFindings(f.session().report.value!).find(item => item.code === 'ADV_RUNTIME_UNKNOWN_TARGET')!
    expect(await f.session().requestRepair('initial', finding.id)).toBe(false)
    expect(f.session().error.value).toBe('repair')
    const [projectId, runId, decision, key] = vi.mocked(f.client.decide).mock.calls[0]
    expect([projectId, runId]).toEqual(['station', 'run1'])
    expect(decision).toMatchObject({ type: 'request-rework', taskId: 'initial', playtestRepair: { reportId: 'report1', findingId: finding.id, snapshotRevision: f.session().report.value!.snapshotRevision } })
    first.unmount()
    const reopened = f.open()
    await flushPromises()
    expect(f.client.decide).toHaveBeenCalledTimes(1)
    expect(await f.session().requestRepair('initial', finding.id)).toBe(true)
    expect(vi.mocked(f.client.decide).mock.calls.map(item => item[3])).toEqual([key, key])
    expect(f.client.refreshFacts).toHaveBeenCalledTimes(2)
    reopened.unmount()
  })

  it('does not request repair from a changed local source or from a service without repair availability', async () => {
    const f = await fixture()
    f.breakSource()
    const wrapper = f.open()
    await flushPromises()
    await f.session().execute(scenarios, false)
    const finding = creativePlaytestFindings(f.session().report.value!)[0]
    expect(await f.session().requestRepair('initial', finding.id)).toBe(false)
    f.edit()
    expect(await f.session().requestRepair('initial', finding.id)).toBe(false)
    expect(f.client.decide).not.toHaveBeenCalled()
    expect(f.client.refreshFacts).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('discards a source read and cloud report that finish after the account and project switch', async () => {
    const f = await fixture()
    const wrapper = f.open()
    await flushPromises()
    let release!: (value: Awaited<ReturnType<typeof f.snapshot>>) => void
    const before = await f.snapshot()
    f.snapshot.mockReturnValueOnce(new Promise(resolve => release = resolve))
    const old = f.session().execute(scenarios, false)
    f.current.value = { ...f.current.value, id: 'other-run', accountId: 'another-account', plan: { ...f.current.value.plan, projectId: 'other-project' } }
    await flushPromises()
    release(before)
    await old
    expect(f.rows.size).toBe(0)
    expect(f.session().report.value).toBeUndefined()
    let receive!: (value: CreativePlaytestReport) => void
    vi.mocked(f.client.getPlaytest).mockReturnValueOnce(new Promise(resolve => receive = resolve))
    const previous = f.session().open('old-report')
    f.current.value = { ...f.current.value, id: 'third-run' }
    await flushPromises()
    receive({ projectId: 'station' } as CreativePlaytestReport)
    await previous
    expect(f.session().report.value).toBeUndefined()
    expect(f.client.recordPlaytest).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
