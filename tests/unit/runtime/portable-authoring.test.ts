import { describe, expect, it, vi } from 'vitest'
import { applyFlowEdit, createPreviewSession, flowEditGraph, layoutFlowGraph, parseFlowDocument, serializeFlowDocument } from '../../../packages/core/src/authoring'

describe('portable Flow authoring entry', () => {
  it('preserves host metadata, explicit disconnects, cycles and immutable identities', () => {
    const source = { schemaVersion: 1, id: 'demo', title: 'Demo', startNodeId: 'first', extension: { host: 'custom' }, nodes: [
      { id: 'first', type: 'choices', next: null, customData: { kind: 'wait', seconds: 2 }, choices: [{ id: 'again', text: 'Again', target: 'first', customData: { enabled: { var: 'allowed' } } }] },
      { id: 'unreachable', type: 'end' },
    ] }
    const document = parseFlowDocument(JSON.stringify(source))
    const edited = applyFlowEdit(document, { type: 'update-choice', nodeId: 'first', choiceId: 'again', patch: { text: 'Repeat' } })
    expect(source.nodes[0]!.choices![0]!.text).toBe('Again')
    expect(JSON.parse(serializeFlowDocument(edited)).nodes[0].customData).toEqual(source.nodes[0]!.customData)
    expect(edited.extension).toEqual(source.extension)
    expect(flowEditGraph(edited).edges).toHaveLength(1)
    expect(flowEditGraph(edited).edges[0]).toMatchObject({ source: 'first', target: { chapterId: 'demo', nodeId: 'first' } })
    expect(layoutFlowGraph(edited).positions).toEqual({ first: { x: 64, y: 64 }, unreachable: { x: 384, y: 64 } })
    expect(() => applyFlowEdit(edited, { type: 'update-choice', nodeId: 'first', choiceId: 'again', patch: { id: 'different' } })).toThrow('IMMUTABLE_ID')
    expect(() => applyFlowEdit(edited, { type: 'delete-node', nodeId: 'first' })).toThrow('NODE_REFERENCED')
  })

  it('handles empty graphs and external routes without emitting invalid positions', () => {
    const empty = parseFlowDocument('{"schemaVersion":1,"id":"demo","title":"Empty","nodes":[]}')
    expect(layoutFlowGraph(empty).positions).toEqual({})
    expect(Number.isFinite(layoutFlowGraph(empty).width)).toBe(true)
    expect(() => layoutFlowGraph(empty, { row: 0 })).toThrow('INVALID_LAYOUT')
  })
})

describe('in-memory preview adapter', () => {
  it('restores host effects and transient timers on failure and back, with detached bounded traces', async () => {
    let state = { total: 0, timer: 0 }
    const reset = vi.fn(() => {
      state = { total: 0, timer: 0 }
    })
    const preview = createPreviewSession<{ amount: number, fail?: boolean }>({
      reset,
      apply(command) {
        state.total += command.amount
        state.timer += 0.5
        if (command.fail)
          throw new Error('Host rejected input')
      },
      inspect: () => state,
      describe: () => ({ label: 'Apply', messages: ['Host changed'] }),
    }, { maxInputs: 3, maxTraceEntries: 1 })
    const input = { amount: 2 }
    await preview.dispatch(input)
    input.amount = 99
    await preview.dispatch({ amount: 3 })
    expect(state).toEqual({ total: 5, timer: 1 })
    const trace = preview.inspect().trace
    expect(trace).toHaveLength(1)
    expect(trace[0]!.sequence).toBe(2)
    trace[0]!.messages.push('Mutation')
    expect(preview.inspect().trace[0]!.messages).toEqual(['Host changed'])
    await expect(preview.dispatch({ amount: 100, fail: true })).rejects.toThrow('Host rejected')
    expect(state).toEqual({ total: 5, timer: 1 })
    expect(preview.inspect().steps).toBe(2)
    await preview.back()
    expect(state).toEqual({ total: 2, timer: 0.5 })
    await preview.dispatch({ amount: 1 })
    await preview.dispatch({ amount: 1 })
    await expect(preview.dispatch({ amount: 1 })).rejects.toThrow('INPUT_LIMIT')
    expect(reset).toHaveBeenCalledTimes(2)
  })

  it('rejects concurrent inputs and marks a failed replay unusable', async () => {
    let release!: () => void
    const preview = createPreviewSession<number>({
      reset() {
        throw new Error('Cannot replay')
      },
      async apply() {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        throw new Error('Failed')
      },
      inspect: () => ({}),
      describe: () => ({ label: 'Wait' }),
    })
    const running = preview.dispatch(1)
    await expect(preview.dispatch(2)).rejects.toThrow('BUSY')
    await expect(preview.back()).rejects.toThrow('BUSY')
    release()
    await expect(running).rejects.toThrow('REPLAY_FAILED')
    expect(preview.inspect().broken).toBe(true)
    await expect(preview.dispatch(3)).rejects.toThrow('REPLAY_FAILED')
  })
})
