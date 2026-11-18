import type { VoiceCleanupPlan, VoiceCleanupResult, VoiceProviderMaintenancePort, VoiceProviderMaintenanceSnapshot } from '@advjs/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowReactive, shallowRef } from 'vue'
import { useVoiceProviderMaintenance } from '../../../editor/core/app/composables/useVoiceProviderMaintenance'

const context = vi.hoisted(() => ({ project: {} as { workspace?: { voiceMaintenance: VoiceProviderMaintenancePort } } }))
vi.mock('../../../editor/core/app/stores/useProjectStore', () => ({ useProjectStore: () => context.project }))

let wrapper: ReturnType<typeof mount>
let maintenance: ReturnType<typeof useVoiceProviderMaintenance>
const visible = shallowRef(true)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function snapshot(id: string): VoiceProviderMaintenanceSnapshot {
  return { providers: [{ id, enabled: true, managed: true, running: false, canStop: true, resources: [] }] }
}
function plan(providerId = 'old'): VoiceCleanupPlan {
  return { id: `${providerId}-plan`, hash: 'reviewed-hash', providerId, resourceIds: [], allowShared: false, resources: [], expiresAt: '2026-10-27T12:00:00.000Z', totalBytes: 0, preserved: ['reference audio'], packageRemovalCommand: 'pnpm remove provider' }
}
function result(providerId = 'old'): VoiceCleanupResult {
  return { providerId, disabled: true, removed: [], removedBytes: 0, availableSpaceDelta: 0, packageRemoved: false }
}
function port(id: string): VoiceProviderMaintenancePort {
  return {
    read: vi.fn(async () => snapshot(id)),
    plan: vi.fn(async () => plan(id)),
    execute: vi.fn(async () => result(id)),
    stop: vi.fn(async () => {}),
    enable: vi.fn(async () => {}),
  }
}
function open(source: VoiceProviderMaintenancePort) {
  context.project.workspace = { voiceMaintenance: source }
  wrapper = mount(defineComponent({
    setup() {
      maintenance = useVoiceProviderMaintenance(() => visible.value)
      return () => h('div')
    },
  }))
}
beforeEach(() => {
  context.project = shallowReactive({})
  visible.value = true
})
afterEach(() => wrapper?.unmount())

describe('voice provider maintenance workspace lifecycle', () => {
  it('refreshes the next project while an aborted native read finishes', async () => {
    const old = port('old')
    let signal!: AbortSignal
    old.read = vi.fn(async (input) => {
      signal = input!
      return await new Promise<VoiceProviderMaintenanceSnapshot>((_yes, no) => signal.addEventListener('abort', () => no(signal.reason), { once: true }))
    })
    open(old)
    const next = port('next')
    const nextRead = deferred<VoiceProviderMaintenanceSnapshot>()
    next.read = vi.fn(async () => nextRead.promise)
    context.project.workspace = { voiceMaintenance: next }
    await flushPromises()
    expect(signal.aborted).toBe(true)
    expect(next.read).toHaveBeenCalledOnce()
    expect(maintenance.pending.value).toBe(true)
    nextRead.resolve(snapshot('next'))
    await flushPromises()
    expect(maintenance.providerId.value).toBe('next')
    expect(maintenance.pending.value).toBe(false)
    expect(maintenance.error.value).toBe('')
  })

  it('clears approvals and ignores an old read that does not honor cancellation', async () => {
    const old = port('old')
    const oldRead = deferred<VoiceProviderMaintenanceSnapshot>()
    old.read = vi.fn(async () => oldRead.promise)
    open(old)
    maintenance.providerId.value = 'old'
    maintenance.selected.value = ['old-model']
    maintenance.allowShared.value = true
    maintenance.review.value = plan()
    maintenance.reviewed.value = true
    maintenance.result.value = result()
    maintenance.error.value = 'Old failure'
    const next = port('next')
    const nextRead = deferred<VoiceProviderMaintenanceSnapshot>()
    next.read = vi.fn(async () => nextRead.promise)
    context.project.workspace = { voiceMaintenance: next }
    expect(maintenance.providerId.value).toBe('')
    expect(maintenance.selected.value).toEqual([])
    expect(maintenance.allowShared.value).toBe(false)
    expect(maintenance.review.value).toBeUndefined()
    expect(maintenance.reviewed.value).toBe(false)
    expect(maintenance.result.value).toBeUndefined()
    expect(maintenance.error.value).toBe('')
    oldRead.resolve(snapshot('old'))
    await flushPromises()
    expect(maintenance.snapshot.value).toBeUndefined()
    expect(maintenance.pending.value).toBe(true)
    nextRead.resolve(snapshot('next'))
    await flushPromises()
    expect(maintenance.snapshot.value).toEqual(snapshot('next'))
  })

  it('does not attach an old review or failure to a new project', async () => {
    const old = port('old')
    const oldPlan = deferred<VoiceCleanupPlan>()
    old.plan = vi.fn(async () => oldPlan.promise)
    open(old)
    await flushPromises()
    const operation = maintenance.plan()
    const next = port('next')
    context.project.workspace = { voiceMaintenance: next }
    await flushPromises()
    oldPlan.reject(new Error('VOICE_INSTALLATION_UNTRUSTED'))
    await operation
    expect(maintenance.review.value).toBeUndefined()
    expect(maintenance.error.value).toBe('')
    expect(maintenance.snapshot.value).toEqual(snapshot('next'))
  })

  it.each(['execute', 'stop', 'enable'] as const)('keeps an old %s response from refreshing or clearing a new request', async (action) => {
    const old = port('old')
    const completion = deferred<VoiceCleanupResult>()
    if (action === 'execute') {
      old.execute = vi.fn(async () => completion.promise)
    }
    else {
      old[action] = vi.fn(async () => {
        await completion.promise
      })
    }
    open(old)
    await flushPromises()
    maintenance.review.value = plan()
    maintenance.reviewed.value = true
    const operation = maintenance[action]()
    const next = port('next')
    const nextRead = deferred<VoiceProviderMaintenanceSnapshot>()
    next.read = vi.fn(async () => nextRead.promise)
    context.project.workspace = { voiceMaintenance: next }
    completion.resolve(result())
    await operation
    await flushPromises()
    expect(old.read).toHaveBeenCalledOnce()
    expect(next.read).toHaveBeenCalledOnce()
    expect(maintenance.pending.value).toBe(true)
    expect(maintenance.result.value).toBeUndefined()
    nextRead.resolve(snapshot('next'))
    await flushPromises()
    expect(maintenance.providerId.value).toBe('next')
  })

  it('aborts hidden reads and refreshes on show without accepting a late response', async () => {
    const source = port('current')
    const first = deferred<VoiceProviderMaintenanceSnapshot>()
    const second = deferred<VoiceProviderMaintenanceSnapshot>()
    const signals: AbortSignal[] = []
    source.read = vi.fn(async (signal) => {
      signals.push(signal!)
      return signals.length === 1 ? first.promise : second.promise
    })
    open(source)
    visible.value = false
    expect(signals[0]!.aborted).toBe(true)
    expect(maintenance.pending.value).toBe(false)
    visible.value = true
    expect(source.read).toHaveBeenCalledTimes(2)
    first.resolve(snapshot('obsolete'))
    await flushPromises()
    expect(maintenance.snapshot.value).toBeUndefined()
    expect(maintenance.pending.value).toBe(true)
    second.resolve(snapshot('current'))
    await flushPromises()
    expect(maintenance.providerId.value).toBe('current')
  })

  it('ignores late responses and further actions after unmount', async () => {
    const source = port('current')
    const pendingRead = deferred<VoiceProviderMaintenanceSnapshot>()
    let signal!: AbortSignal
    source.read = vi.fn(async (input) => {
      signal = input!
      return pendingRead.promise
    })
    open(source)
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    pendingRead.resolve(snapshot('late'))
    await flushPromises()
    await maintenance.reload()
    expect(source.read).toHaveBeenCalledOnce()
    expect(maintenance.snapshot.value).toBeUndefined()
    expect(maintenance.pending.value).toBe(false)
  })

  it('does not imply that losing a cleanup response undoes server-side removal', async () => {
    const source = port('current')
    source.execute = vi.fn(async () => {
      throw new Error('Connection lost')
    })
    open(source)
    await flushPromises()
    maintenance.review.value = plan('current')
    maintenance.reviewed.value = true
    await maintenance.execute()
    expect(maintenance.error.value).toContain('不代表已经开始的服务端清理已撤销')
    expect(source.execute).toHaveBeenCalledOnce()
  })
})
