import { describe, expect, it } from 'vitest'
import {
  AdvMarkdownRuntimeError,
  createAdvMarkdownRuntime,
  defineAdvPlugin,
} from '../../src/runtime'

const observerPlugin = defineAdvPlugin({
  name: 'observer',
  version: '1.0.0',
  nodes: {
    compare({ activity, node }) {
      activity('compare', node.data)
    },
  },
  activities: {
    compare({ state, input }, result) {
      state.variables.lastTolerance = input.tolerance ?? null
      state.variables.accepted = result === true
    },
  },
})

describe('createAdvMarkdownRuntime', () => {
  it('compiles chapters, validates plugins, and returns an idle runtime', async () => {
    const created = await createAdvMarkdownRuntime({
      id: 'markdown-runtime',
      requiredPlugins: { observer: '1.0.0' },
      plugins: [observerPlugin],
      initialVariables: { accepted: false },
      chapters: [{
        id: 'chapter-1',
        content: [
          '```yaml',
          'type: activity',
          'use: observer/compare',
          'input:',
          '  tolerance: 0.8',
          '```',
        ].join('\n'),
      }],
    })

    expect(created.diagnostics).toEqual([])
    expect(created.runtime.state.status).toBe('idle')

    await created.runtime.start()
    expect(created.runtime.state).toMatchObject({
      status: 'waiting-activity',
      pendingActivity: {
        type: 'observer/compare',
        input: { tolerance: 0.8 },
      },
    })

    await created.runtime.completeActivity(true)
    expect(created.runtime.state.variables).toMatchObject({
      accepted: true,
      lastTolerance: 0.8,
    })
  })

  it('preserves compiler diagnostics in a typed error', async () => {
    const promise = createAdvMarkdownRuntime({
      id: 'invalid-markdown-runtime',
      chapters: [{
        id: 'chapter-1',
        sourcePath: 'chapters/invalid.adv.md',
        content: '```yaml\ntype: activity\nuse: invalid\n```',
      }],
    })

    await expect(promise).rejects.toMatchObject({
      name: 'AdvMarkdownRuntimeError',
      code: 'ADV_MARKDOWN_RUNTIME_INVALID',
      diagnostics: [
        expect.objectContaining({
          code: 'ADV_RUNTIME_INVALID_ACTIVITY',
          source: expect.objectContaining({ file: 'chapters/invalid.adv.md' }),
        }),
      ],
    })
  })

  it('reports unknown plugin capabilities before the runtime starts', async () => {
    const incompletePlugin = defineAdvPlugin({
      name: 'observer',
      version: '1.0.0',
    })
    const promise = createAdvMarkdownRuntime({
      id: 'unknown-capability',
      requiredPlugins: { observer: '1.0.0' },
      plugins: [incompletePlugin],
      chapters: [{
        id: 'chapter-1',
        content: '```yaml\ntype: activity\nuse: observer/compare\n```',
      }],
    })

    await expect(promise).rejects.toBeInstanceOf(AdvMarkdownRuntimeError)
    await expect(promise).rejects.toMatchObject({
      diagnostics: [
        expect.objectContaining({
          code: 'ADV_RUNTIME_UNKNOWN_NODE',
          address: { chapterId: 'chapter-1', nodeId: 'node-0' },
        }),
      ],
    })
  })
})
