import type { AdvGameConfig, RuntimeProgram } from '@advjs/types'
import type { DevToolsContext } from '../../packages/devtools/client/snapshot'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef, watch } from 'vue'
import { attachDevToolsRuntime, createDevToolsSnapshot } from '../../packages/devtools/client/snapshot'
import { createDevToolsSessions, readDevToolsSnapshot } from '../../packages/devtools/src/sessions'

function fixture() {
  const program: RuntimeProgram = {
    schemaVersion: 1,
    id: 'demo',
    hash: 'hash',
    requiredPlugins: {},
    entry: { chapterId: 'intro', nodeId: 'hello' },
    chapters: { intro: {
      id: 'intro',
      entry: 'hello',
      order: ['hello'],
      nodes: { hello: { id: 'hello', kind: 'end' } },
    } },
  }
  const stopTrace = vi.fn()
  const context: DevToolsContext = {
    observe: callback => watch(() => context.runtime.state.value, callback),
    runtime: {
      program: shallowRef(program),
      current: shallowRef(program.chapters.intro!.nodes.hello),
      state: shallowRef({ status: 'idle', cursor: program.entry, variables: { score: 0 }, stage: { background: '', bgm: '', cg: '', tachies: {} }, choices: [], visited: [] }),
      trace: () => [],
      subscribeTrace: () => stopTrace,
    },
    gameConfig: shallowRef({ title: 'Demo', chapters: [{ id: 'intro', title: '序章', nodes: [] }], characters: [{ id: 'hero', name: '主角' }], scenes: [{ id: 'room', name: '房间' }], bgm: { library: { piano: '/piano.mp3' } }, privateApiKey: 'never-send-this' } as unknown as AdvGameConfig),
    compileDiagnostics: shallowRef([{ severity: 'warning', code: 'MISSING_ASSET', message: '资源未找到' }]),
  }
  return { context, stopTrace }
}

afterEach(() => vi.useRealTimers())

describe('aDV.JS DevTools runtime projections', () => {
  it('projects state, resources and diagnostics without copying configuration secrets', () => {
    const { context } = fixture()
    const snapshot = createDevToolsSnapshot(context, 'http://localhost/game')
    expect(snapshot.program).toEqual({ id: 'demo', hash: 'hash', chapters: 1, nodes: 1 })
    expect(snapshot.resources.map(item => item.name)).toEqual(['序章', '主角', '房间', 'piano'])
    expect(snapshot.diagnostics[0]?.code).toBe('MISSING_ASSET')
    expect(JSON.stringify(snapshot)).not.toContain('never-send-this')
    snapshot.state.variables.score = 10
    expect(context.runtime.state.value.variables.score).toBe(0)
  })

  it('batches changes and releases subscriptions on context replacement', async () => {
    vi.useFakeTimers()
    const { context, stopTrace } = fixture()
    const publish = vi.fn()
    const attachment = attachDevToolsRuntime(context, publish, () => 'http://localhost')
    await vi.advanceTimersByTimeAsync(100)
    expect(publish).toHaveBeenCalledTimes(1)
    Object.assign(context.runtime.state, { value: { ...context.runtime.state.value, status: 'ended' } })
    await nextTick()
    attachment.refresh()
    await vi.advanceTimersByTimeAsync(100)
    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish.mock.calls[1]![0].state.status).toBe('ended')
    attachment.refresh()
    attachment.dispose()
    await vi.advanceTimersByTimeAsync(500)
    expect(stopTrace).toHaveBeenCalledOnce()
    expect(publish).toHaveBeenCalledTimes(2)
  })
})

describe('aDV.JS DevTools sessions', () => {
  it('isolates browser clients and removes disconnected state', () => {
    const sessions = createDevToolsSessions<object>()
    const first = {}
    const second = {}
    const snapshot = createDevToolsSnapshot(fixture().context, 'http://localhost')
    expect(sessions.update(first, snapshot)).toBe(true)
    sessions.update(second, { ...snapshot, title: 'Second' })
    expect(sessions.list().map(item => item.id)).toEqual(['runtime-1', 'runtime-2'])
    sessions.update(first, { ...snapshot, title: 'Updated' })
    expect(sessions.list()[0]?.id).toBe('runtime-1')
    const report = sessions.list()
    report[0]!.snapshot.title = 'Mutated'
    expect(sessions.list()[0]?.snapshot.title).toBe('Updated')
    sessions.remove(first)
    expect(sessions.list()).toHaveLength(1)
    sessions.clear()
    expect(sessions.list()).toEqual([])
  })

  it('rejects invalid, cyclic and oversized snapshots without replacing good state', () => {
    const snapshot = createDevToolsSnapshot(fixture().context, 'http://localhost')
    expect(readDevToolsSnapshot(snapshot)).toEqual(snapshot)
    expect(readDevToolsSnapshot({ ...snapshot, state: {} })).toBeUndefined()
    expect(readDevToolsSnapshot({ ...snapshot, resources: [null] })).toBeUndefined()
    expect(readDevToolsSnapshot({ ...snapshot, title: '汉'.repeat(200000) })).toBeUndefined()
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(readDevToolsSnapshot(cyclic)).toBeUndefined()
    const sessions = createDevToolsSessions<string>()
    sessions.update('one', snapshot)
    expect(sessions.update('one', null)).toBe(false)
    expect(sessions.list()[0]?.snapshot).toEqual(snapshot)
  })
})
