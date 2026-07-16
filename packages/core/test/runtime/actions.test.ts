import { describe, expect, it } from 'vitest'
import { linkRuntimeProgram } from '../../src/compiler'
import { createAdvRuntime } from '../../src/runtime'

describe('runtime conditions and built-in actions', () => {
  it('executes declarative variable actions and filters conditions', async () => {
    const linked = await linkRuntimeProgram({
      id: 'logic-demo',
      entry: { chapterId: 'one', nodeId: 'prepare' },
      chapters: [{
        id: 'one',
        entry: 'prepare',
        nodes: [
          {
            id: 'prepare',
            kind: 'actions',
            actions: [
              { type: 'variables/increment', args: { key: 'score', by: 2 } },
              { type: 'variables/toggle', args: { key: 'enabled' } },
              { type: 'variables/push', args: { key: 'clues', value: 'star' } },
            ],
            next: { chapterId: 'one', nodeId: 'conditional' },
          },
          {
            id: 'conditional',
            kind: 'dialog',
            when: 'score >= 2 && enabled',
            data: { text: 'Visible' },
            next: { chapterId: 'one', nodeId: 'choice' },
          },
          {
            id: 'choice',
            kind: 'choices',
            choices: [
              { id: 'locked', label: 'Locked', when: 'score > 10' },
              { id: 'open', label: 'Open', when: 'score == 2' },
            ],
            next: { chapterId: 'one', nodeId: 'end' },
          },
          { id: 'end', kind: 'end' },
        ],
      }],
    } as any)
    expect(linked.diagnostics).toEqual([])

    const runtime = createAdvRuntime({
      program: linked.program!,
      initialVariables: { score: 0, enabled: false, clues: [] },
    })
    await runtime.start()

    expect(runtime.state.variables).toEqual({
      score: 2,
      enabled: true,
      clues: ['star'],
    })
    expect(runtime.current?.id).toBe('conditional')
    await runtime.next()
    expect(runtime.current?.data?.options).toEqual([
      { id: 'open', label: 'Open', when: expect.any(Object) },
    ])
  })

  it('reports invalid conditions during linking', async () => {
    const linked = await linkRuntimeProgram({
      id: 'bad-condition',
      entry: { chapterId: 'one', nodeId: 'bad' },
      chapters: [{
        id: 'one',
        entry: 'bad',
        nodes: [{ id: 'bad', kind: 'dialog', when: 'window.alert(1)' }],
      }],
    } as any)

    expect(linked.program).toBeUndefined()
    expect(linked.diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_INVALID_CONDITION',
    }))
  })
})
