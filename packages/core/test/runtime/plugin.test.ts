import { describe, expect, it } from 'vitest'
import { linkRuntimeProgram } from '../../src/compiler'
import { createAdvRuntime, defineAdvPlugin } from '../../src/runtime'

async function pluginProgram(requiredPlugins: Record<string, string> = {}) {
  return (await linkRuntimeProgram({
    id: 'plugin-demo',
    entry: { chapterId: 'one', nodeId: 'mark' },
    requiredPlugins,
    chapters: [{
      id: 'one',
      entry: 'mark',
      nodes: [
        {
          id: 'mark',
          kind: 'actions',
          actions: [{ type: 'observer/mark', args: { value: 'ready' } }],
          next: { chapterId: 'one', nodeId: 'end' },
        },
        { id: 'end', kind: 'end' },
      ],
    }],
  } as any)).program!
}

describe('runtime plugins', () => {
  it('namespaces plain-object action registries', async () => {
    const observer = defineAdvPlugin({
      name: 'observer',
      version: '1.0.0',
      actions: {
        mark({ state }, args) {
          state.variables.observerStatus = args.value ?? null
        },
      },
    })
    const runtime = createAdvRuntime({
      program: await pluginProgram({ observer: '1.0.0' }),
      plugins: [observer],
    })

    await runtime.start()
    expect(runtime.state.variables.observerStatus).toBe('ready')
  })

  it('pauses on plugin activities and resumes with JSON results', async () => {
    const observer = defineAdvPlugin({
      name: 'observer',
      version: '1.0.0',
      nodes: {
        compare({ activity, node }) {
          activity('compare', node.data ?? {})
        },
      },
      activities: {
        compare({ state }, result) {
          state.variables.matched = Boolean(
            result && typeof result === 'object' && !Array.isArray(result) && result.matched,
          )
        },
      },
    })
    const linked = await linkRuntimeProgram({
      id: 'activity-demo',
      entry: { chapterId: 'one', nodeId: 'compare' },
      requiredPlugins: { observer: '1.0.0' },
      chapters: [{
        id: 'one',
        entry: 'compare',
        nodes: [
          {
            id: 'compare',
            kind: 'observer/compare',
            data: { tolerance: 0.8 },
            next: { chapterId: 'one', nodeId: 'end' },
          },
          { id: 'end', kind: 'end' },
        ],
      }],
    })
    const runtime = createAdvRuntime({ program: linked.program!, plugins: [observer] })

    const waiting = await runtime.start()
    expect(runtime.state.status).toBe('waiting-activity')
    expect(runtime.state.pendingActivity).toMatchObject({
      type: 'observer/compare',
      input: { tolerance: 0.8 },
      node: { chapterId: 'one', nodeId: 'compare' },
    })
    expect(waiting.effects).toContainEqual(expect.objectContaining({
      type: 'activity.request',
    }))
    await expect(runtime.next()).rejects.toThrow(/ADV_RUNTIME_ACTIVITY_PENDING/)
    const snapshot = runtime.snapshot()
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)

    await runtime.completeActivity({ matched: true })
    expect(runtime.state.variables.matched).toBe(true)
    expect(runtime.state.pendingActivity).toBeUndefined()
    expect(runtime.state.status).toBe('ended')

    runtime.back()
    expect(runtime.state.status).toBe('waiting-activity')
    expect(runtime.state.pendingActivity?.type).toBe('observer/compare')
  })

  it('fails fast for missing required plugins and duplicate capabilities', async () => {
    const requiredProgram = await pluginProgram({ observer: '1.0.0' })
    expect(() => createAdvRuntime({
      program: requiredProgram,
    })).toThrow(/ADV_RUNTIME_MISSING_PLUGIN/)

    const first = defineAdvPlugin({
      name: 'observer',
      version: '1.0.0',
      actions: { mark() {} },
    })
    const duplicate = defineAdvPlugin({
      name: 'observer',
      version: '2.0.0',
      actions: { mark() {} },
    })
    const program = await pluginProgram()
    expect(() => createAdvRuntime({
      program,
      plugins: [first, duplicate],
    })).toThrow(/ADV_RUNTIME_PLUGIN_CONFLICT/)
  })

  it('rejects invalid capabilities and non-JSON plugin mutations', async () => {
    const invalid = defineAdvPlugin({
      name: 'observer',
      version: '1.0.0',
      nodes: { Compare() {} },
    })
    const program = await pluginProgram()
    expect(() => createAdvRuntime({
      program,
      plugins: [invalid],
    })).toThrow(/ADV_RUNTIME_INVALID_PLUGIN/)

    const cyclic = defineAdvPlugin({
      name: 'observer',
      version: '1.0.0',
      actions: {
        mark({ state }) {
          const value: Record<string, unknown> = {}
          value.self = value
          state.variables.observerStatus = value as never
        },
      },
    })
    const runtime = createAdvRuntime({
      program,
      plugins: [cyclic],
    })
    await expect(runtime.start()).rejects.toThrow(/ADV_RUNTIME_NON_JSON_STATE.*circular reference/)
  })
})
