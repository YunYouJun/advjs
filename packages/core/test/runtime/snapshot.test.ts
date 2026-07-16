import type { RuntimeProgram, RuntimeSnapshot } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createAdvRuntime } from '../../src/runtime'

const program: RuntimeProgram = {
  schemaVersion: 1,
  id: 'snapshot-demo',
  hash: 'snapshot-demo-v1',
  entry: { chapterId: 'chapter-1', nodeId: 'stage' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'stage',
      order: ['stage', 'line', 'choose', 'end'],
      nodes: {
        stage: {
          id: 'stage',
          kind: 'effects',
          data: { operations: [{ type: 'background', url: 'night.webp' }] },
          next: { chapterId: 'chapter-1', nodeId: 'line' },
        },
        line: {
          id: 'line',
          kind: 'dialog',
          data: { character: '我', text: '星图已经展开。' },
          next: { chapterId: 'chapter-1', nodeId: 'choose' },
        },
        choose: {
          id: 'choose',
          kind: 'choices',
          data: {
            options: [{
              id: 'cross-chapter',
              label: '前往比对',
              target: { chapterId: 'chapter-2', nodeId: 'result' },
            }],
          },
          next: { chapterId: 'chapter-1', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
    'chapter-2': {
      id: 'chapter-2',
      entry: 'result',
      order: ['result', 'end'],
      nodes: {
        result: {
          id: 'result',
          kind: 'text',
          data: { text: '比对完成。' },
          next: { chapterId: 'chapter-2', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}

async function createProgressedRuntime() {
  let time = 100
  const runtime = createAdvRuntime({
    program,
    initialVariables: { observationCount: 2, nested: { matched: false } },
    now: () => time++,
  })
  await runtime.start()
  await runtime.next()
  await runtime.choose('cross-chapter')
  return runtime
}

describe('runtime snapshots', () => {
  it('round-trips complete JSON state and checkpoints', async () => {
    const runtime = await createProgressedRuntime()
    const snapshot = runtime.snapshot()
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as RuntimeSnapshot

    expect(roundTripped).toMatchObject({
      schemaVersion: 1,
      program: { id: program.id, hash: program.hash },
      state: {
        status: 'playing',
        cursor: { chapterId: 'chapter-2', nodeId: 'result' },
        variables: { observationCount: 2, nested: { matched: false } },
        stage: { background: 'night.webp' },
        choices: [{
          node: { chapterId: 'chapter-1', nodeId: 'choose' },
          choiceId: 'cross-chapter',
        }],
      },
    })
    expect(roundTripped.checkpoints).toHaveLength(2)

    const restored = createAdvRuntime({ program })
    restored.restore(roundTripped)
    expect(restored.state).toEqual(runtime.state)
    expect(restored.snapshot().checkpoints).toEqual(roundTripped.checkpoints)
  })

  it('rolls back choices and cross-chapter navigation from full checkpoints', async () => {
    const runtime = await createProgressedRuntime()

    const choice = runtime.back()
    expect(choice.state).toMatchObject({
      status: 'waiting-choice',
      cursor: { chapterId: 'chapter-1', nodeId: 'choose' },
      choices: [],
      stage: { background: 'night.webp' },
    })

    const line = runtime.back()
    expect(line.state).toMatchObject({
      status: 'playing',
      cursor: { chapterId: 'chapter-1', nodeId: 'line' },
      variables: { observationCount: 2 },
      stage: { background: 'night.webp' },
    })
    expect(() => runtime.back()).toThrow(/ADV_RUNTIME_NO_CHECKPOINT/)
  })

  it('deduplicates consecutive states and caps checkpoint history', async () => {
    let time = 1
    const runtime = createAdvRuntime({
      program,
      maxCheckpoints: 2,
      now: () => time++,
    })
    await runtime.start()

    await runtime.go('#line')
    await runtime.go('#line')
    expect(runtime.snapshot().checkpoints).toHaveLength(1)

    await runtime.go('#choose')
    await runtime.go('chapter-2')
    const snapshot = runtime.snapshot()
    expect(snapshot.checkpoints).toHaveLength(2)
    expect(new Set(snapshot.checkpoints.map(item => item.id)).size).toBe(2)
  })

  it('returns immutable copies and publishes restore/back effects', async () => {
    const runtime = await createProgressedRuntime()
    const effects: string[] = []
    runtime.subscribe((_state, published) => {
      effects.push(...published.map(effect => effect.type))
    })
    const snapshot = runtime.snapshot()

    snapshot.state.variables.observationCount = 999
    snapshot.checkpoints[0].state.stage.background = 'mutated.webp'
    expect(runtime.state.variables.observationCount).toBe(2)
    expect(runtime.snapshot().checkpoints[0].state.stage.background).toBe('night.webp')

    const valid = runtime.snapshot()
    runtime.back()
    runtime.restore(valid)
    expect(effects).toEqual(['runtime.back', 'runtime.restore'])
  })

  it.each([
    ['schema', (snapshot: RuntimeSnapshot) => { snapshot.schemaVersion = 2 as 1 }],
    ['program id', (snapshot: RuntimeSnapshot) => { snapshot.program.id = 'other' }],
    ['program hash', (snapshot: RuntimeSnapshot) => { snapshot.program.hash = 'other' }],
    ['cursor', (snapshot: RuntimeSnapshot) => { snapshot.state.cursor.nodeId = 'missing' }],
    ['checkpoint cursor', (snapshot: RuntimeSnapshot) => { snapshot.checkpoints[0].state.cursor.nodeId = 'missing' }],
    ['non-json value', (snapshot: RuntimeSnapshot) => {
      Object.assign(snapshot.state.variables, { invalid: undefined })
    }],
  ])('rejects incompatible or malformed %s before mutation', async (_name, mutate) => {
    const runtime = await createProgressedRuntime()
    const before = runtime.state
    const snapshot = runtime.snapshot()
    mutate(snapshot)

    expect(() => runtime.restore(snapshot)).toThrow(/ADV_RUNTIME_INVALID_SNAPSHOT|ADV_RUNTIME_SNAPSHOT_MISMATCH/)
    expect(runtime.state).toEqual(before)
  })
})
