import type { CreativeTeamClient, CreativeTeamRun } from '@advjs/agent'
import { createCreativeBootstrapPlan, createCreativeTeamRun, parseCreativeTeamStartRequest } from '@advjs/agent'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreativeTeamStore } from '../stores/useCreativeTeamStore'

const project = { id: 'station', revision: 'r1', files: { 'adv/world.md': '# 雨夜车站' } }
const request = parseCreativeTeamStartRequest({ protocolVersion: 1, project, partner: 'director', goal: '两个结局', locale: 'zh-CN', limits: { maxTasks: 12, maxToolCalls: 64, maxReworkRounds: 2, maxMicroPoints: 1000 } })
function run(): CreativeTeamRun {
  return createCreativeTeamRun({ id: 'run1', accountId: 'account1', plan: createCreativeBootstrapPlan(request), now: 1 })
}
function client() {
  return {
    availability: vi.fn<CreativeTeamClient['availability']>(async () => ({ protocolVersion: 1, enabled: true, serviceVersion: 'local-test-only', capabilities: ['plan-production'], maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'manual-import' } })),
    list: vi.fn<CreativeTeamClient['list']>(async () => [{ id: 'run1', projectId: 'station', goal: '两个结局', status: 'awaiting_plan_review', revision: 0, chargedMicroPoints: 0, reservedMicroPoints: 0, updatedAt: 1 }]),
    get: vi.fn<CreativeTeamClient['get']>(async () => run()),
    start: vi.fn<CreativeTeamClient['start']>(async () => run()),
    decide: vi.fn<CreativeTeamClient['decide']>(async () => ({ ...run(), status: 'running', revision: 3 })),
    refreshFacts: vi.fn<CreativeTeamClient['refreshFacts']>(async () => run()),
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}
beforeEach(() => setActivePinia(createPinia()))

describe('creative team persisted session', () => {
  it('shows disabled service without reading unavailable history or submitting work', async () => {
    const api = client()
    api.availability.mockResolvedValue({ ...(await api.availability()), enabled: false })
    const store = useCreativeTeamStore()
    store.configure({ client: api, accountId: 'account1', projectId: 'station' })
    await store.refresh()
    expect(store.availability?.enabled).toBe(false)
    expect(store.canStart).toBe(false)
    expect(api.list).not.toHaveBeenCalled()
    expect(api.start).not.toHaveBeenCalled()
  })

  it('reconnects through reads and recovers the review without replaying generation', async () => {
    const api = client()
    const store = useCreativeTeamStore()
    store.configure({ client: api, accountId: 'account1', projectId: 'station' })
    await store.refresh()
    await store.refresh()
    expect(store.run?.id).toBe('run1')
    expect(store.canStart).toBe(false)
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(api.start).not.toHaveBeenCalled()
    expect(api.decide).not.toHaveBeenCalled()
    expect(api.refreshFacts).not.toHaveBeenCalled()
  })

  it('drops a late response after a project or account change', async () => {
    const pending = deferred<CreativeTeamRun>()
    const api = client()
    api.get.mockReturnValue(pending.promise)
    const store = useCreativeTeamStore()
    store.configure({ client: api, accountId: 'account1', projectId: 'station' })
    const old = store.refresh()
    await flushPromises()
    store.configure({ client: client(), accountId: 'account2', projectId: 'other' })
    pending.resolve(run())
    await old
    expect(store.run).toBeUndefined()
    expect(store.runs).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('keeps a newer explicit decision when an older read finishes later', async () => {
    const api = client()
    const store = useCreativeTeamStore()
    store.configure({ client: api, accountId: 'account1', projectId: 'station' })
    await store.refresh()
    const pending = deferred<CreativeTeamRun>()
    api.get.mockReturnValue(pending.promise)
    const old = store.refresh()
    await flushPromises()
    await store.decide({ type: 'approve-plan' }, project)
    pending.resolve(run())
    await old
    expect(store.run?.revision).toBe(3)
    expect(api.decide).toHaveBeenCalledTimes(1)
    expect(api.refreshFacts).toHaveBeenCalledTimes(1)
  })

  it('never automatically retries an unconfirmed paid decision', async () => {
    const api = client()
    const store = useCreativeTeamStore()
    store.configure({ client: api, accountId: 'account1', projectId: 'station' })
    await store.refresh()
    api.decide.mockRejectedValue(new Error('response lost'))
    await store.decide({ type: 'approve-plan' })
    expect(store.error).toBe('connection')
    expect(store.run?.status).toBe('awaiting_plan_review')
    await store.refresh()
    expect(api.decide).toHaveBeenCalledTimes(1)
    expect(api.start).not.toHaveBeenCalled()
  })

  it('does not submit the paid decision if scope changes while facts are being checked', async () => {
    const api = client()
    const store = useCreativeTeamStore()
    store.configure({ client: api, accountId: 'account1', projectId: 'station' })
    await store.refresh()
    const pending = deferred<CreativeTeamRun>()
    api.refreshFacts.mockReturnValue(pending.promise)
    const mutation = store.decide({ type: 'approve-plan' }, project)
    store.disconnect()
    pending.resolve(run())
    await mutation
    expect(api.decide).not.toHaveBeenCalled()
    expect(store.run).toBeUndefined()
  })
})
