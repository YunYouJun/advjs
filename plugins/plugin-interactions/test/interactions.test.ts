import { createAdvRuntime, linkRuntimeProgram } from '@advjs/core'
import { describe, expect, it } from 'vitest'
import { civilization, starMap } from '../src'

async function activityProgram(kind: string, plugin: string) {
  return (await linkRuntimeProgram({
    id: kind,
    entry: { chapterId: 'one', nodeId: 'activity' },
    requiredPlugins: { [plugin]: '1.0.0' },
    chapters: [{
      id: 'one',
      entry: 'activity',
      nodes: [
        {
          id: 'activity',
          kind,
          data: {},
          next: { chapterId: 'one', nodeId: 'end' },
        },
        { id: 'end', kind: 'end' },
      ],
    }],
  })).program!
}

describe('interaction plugins', () => {
  it('records star-map comparison results', async () => {
    const runtime = createAdvRuntime({
      program: await activityProgram('star-map/compare', 'star-map'),
      plugins: [starMap()],
    })
    await runtime.start()
    await runtime.completeActivity({ matched: true, score: 0.92 })
    expect(runtime.state.variables).toMatchObject({
      starMatched: true,
      starMatchScore: 0.92,
    })
  })

  it('records civilization initialization as JSON variables', async () => {
    const runtime = createAdvRuntime({
      program: await activityProgram('civilization/initialize', 'civilization'),
      plugins: [civilization()],
    })
    await runtime.start()
    await runtime.completeActivity({ name: 'Seed', level: 2, principle: 'curiosity' })
    expect(runtime.state.variables.civilization).toEqual({
      name: 'Seed',
      level: 2,
      principle: 'curiosity',
    })
  })
})
