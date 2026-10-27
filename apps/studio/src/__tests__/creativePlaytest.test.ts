import type { CreativePlaytestReport, CreativeTeamClient } from '@advjs/agent'
import type { CreativePlaytestCacheEntry } from '../utils/creativePlaytestCache'
import { computeAgentProjectRevision, createCreativeBootstrapPlan, createCreativeTeamRun, parseCreativeTeamStartRequest } from '@advjs/agent'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef, watch } from 'vue'
import frozen from '../../../../packages/agent/test/fixtures/creative-team/v2/project.json'
import { useCreativePlaytest } from '../composables/useCreativePlaytest'
import { useCreativeTeamStore } from '../stores/useCreativeTeamStore'

beforeEach(() => setActivePinia(createPinia()))
async function fixture() {
  let files: Record<string, string> = structuredClone(frozen.files)
  const snapshot = vi.fn(async () => ({ projectId: 'station', files: { ...files }, revision: await computeAgentProjectRevision(files) }))
  const project = { id: 'station', files, revision: (await snapshot()).revision }
  const request = parseCreativeTeamStartRequest({ protocolVersion: 1, project, partner: 'writer', goal: '两个结局', locale: 'zh-CN', limits: { maxTasks: 4, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 1000 } })
  const run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan: createCreativeBootstrapPlan(request), now: 0 })
  const unavailable = vi.fn(async (): Promise<never> => {
    throw new Error('Unexpected model call')
  })
  const client: CreativeTeamClient = { availability: async () => ({ protocolVersion: 1, enabled: false, serviceVersion: 'test-only', capabilities: [], maxConcurrentTasks: 1, authoring: { candidateEdits: true, milestoneAdoption: true, playtestReports: true }, media: { image: 'unavailable', voice: 'unavailable' } }), list: async () => [], get: async () => structuredClone(run), start: unavailable, decide: unavailable, refreshFacts: unavailable, editCandidate: unavailable, milestone: unavailable, recordPlaytest: vi.fn(async () => ({ ...structuredClone(run), revision: 2 })), getPlaytest: vi.fn() }
  const store = useCreativeTeamStore()
  store.configure({ client, accountId: 'author1', projectId: 'station' })
  await store.refresh()
  await store.open(run.id)
  const current = shallowRef(store.run!)
  const rows = new Map<string, CreativePlaytestCacheEntry>()
  const cache = { list: vi.fn(async (scope: { accountId: string, projectId: string, runId: string }) => [...rows.values()].filter(item => item.accountId === scope.accountId && item.projectId === scope.projectId && item.runId === scope.runId)), save: vi.fn(async (entry: CreativePlaytestCacheEntry) => {
    rows.set(entry.id, structuredClone(entry))
  }) }
  let session!: ReturnType<typeof useCreativePlaytest>
  function open() {
    const wrapper = mount(defineComponent({ setup() {
      watch(() => store.run, value => value && (current.value = value))
      session = useCreativePlaytest({ run: () => current.value, workspace: async () => ({ snapshot, capabilities: ['candidate-preview'], commit: unavailable }), cache })
      return () => h('div')
    } }))
    return wrapper
  }
  return { store, client, rows, snapshot, cache, current, open, session: () => session, unavailable, edit: () => files = { ...files, 'adv/world.md': '作者修改了世界设定。' } }
}
const scenarios = [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }]

describe('creative path execution, persistence and scope', () => {
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
