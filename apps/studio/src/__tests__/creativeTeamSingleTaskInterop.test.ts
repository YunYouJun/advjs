import type { AgentRuntime } from '@advjs/agent'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { useManagedAgentStore } from '../stores/useManagedAgentStore'

/** The shared v2 ledger reports a count, without exposing another task's proposal as a legacy task. */
describe('creative team and single-task account admission', () => {
  it('blocks legacy starts while a crew reservation is active and releases after settlement', async () => {
    setActivePinia(createPinia())
    let activeReservationCount = 1
    const runtime: AgentRuntime = { start: vi.fn(), resume: vi.fn(), getTask: vi.fn(), cancel: vi.fn() }
    const store = useManagedAgentStore()
    store.configure({ runtime, points: { getPoints: async () => ({ availableMicroPoints: 1000, reservedMicroPoints: 100, chargedMicroPoints: 0, activeReservationCount }) } })
    await store.refreshPoints()
    expect(store.hasActiveTask).toBe(true)
    expect(store.canStartTask).toBe(false)
    expect(runtime.getTask).not.toHaveBeenCalled()
    activeReservationCount = 0
    await store.refreshPoints()
    expect(store.canStartTask).toBe(true)
    expect(runtime.start).not.toHaveBeenCalled()
  })
})
