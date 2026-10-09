import type { RuntimeProgram, RuntimeSnapshot } from '@advjs/types'
import { createAdvRuntime, defineAdvPlugin, visibleRuntimeChoices } from '@advjs/core/runtime'

export interface GameWorld { hasQuest: boolean }
export interface DialogueView {
  text: string
  speaker: string
  choices: { id: string, label: string }[]
  ended: boolean
}
export interface GameHost {
  world: () => GameWorld
  acceptQuest: (questId: 'town-delivery') => { ok: boolean, world: GameWorld }
  freeze: (frozen: boolean) => void
  present: (view: DialogueView) => void
  save: (snapshot: RuntimeSnapshot) => void
}

/** Reference host adapter, not an additional Core API. Lazy-load this module. */
export function createEmbeddedSession(program: RuntimeProgram, host: GameHost, saved?: RuntimeSnapshot) {
  const bridge = defineAdvPlugin({
    name: 'game-bridge',
    version: '1.0.0',
    nodes: { request: ({ activity, node }) => activity('request', node.data ?? {}) },
    activities: {
      request({ state }, result) {
        if (!result || typeof result !== 'object' || Array.isArray(result)
          || typeof result.ok !== 'boolean' || !result.world || typeof result.world !== 'object'
          || Array.isArray(result.world) || typeof result.world.hasQuest !== 'boolean') {
          throw new Error('Invalid game result')
        }
        state.variables.requestOk = result.ok
        state.variables.game = { hasQuest: result.world.hasQuest }
      },
    },
    activityRollback: { request: 'unsupported' },
  })
  const runtime = createAdvRuntime({
    program,
    plugins: [bridge],
    initialVariables: { game: { ...host.world() }, requestOk: false },
    maxCheckpoints: 0,
    maxTraceEntries: 0,
  })
  let restarted = false
  if (saved && saved.state.status !== 'ended') {
    try {
      runtime.restore({ ...saved, state: { ...saved.state, variables: { ...saved.state.variables, game: { ...host.world() } } } })
    }
    catch { restarted = true }
  }
  let active = true
  let busy = false
  host.freeze(true)

  async function run(action: () => Promise<unknown>) {
    if (!active || busy)
      return
    busy = true
    try {
      await action()
      if (!active)
        return
      const pending = runtime.state.pendingActivity
      if (pending) {
        if (pending.type !== 'game-bridge/request' || pending.input.operation !== 'accept-quest'
          || pending.input.questId !== 'town-delivery') {
          throw new Error('Unsupported game request')
        }
        const result = host.acceptQuest('town-delivery')
        await runtime.completeActivity({ ok: result.ok, world: { ...result.world } })
      }
      if (!active)
        return
      if (runtime.state.status === 'error')
        throw new Error(runtime.state.error?.message ?? 'Story failed')
      const node = runtime.current
      host.present({
        speaker: String(node?.data?.character ?? ''),
        text: String(node?.data?.text ?? ''),
        choices: node?.kind === 'choices' ? visibleRuntimeChoices(node.data, runtime.state).map(({ id, label }) => ({ id, label })) : [],
        ended: runtime.state.status === 'ended',
      })
      host.save(runtime.snapshot())
    }
    finally { busy = false }
  }
  return {
    restarted,
    start: () => run(async () => {
      if (runtime.state.status === 'idle')
        await runtime.start()
    }),
    next: () => run(() => runtime.next()),
    choose: (id: string) => run(() => runtime.choose(id)),
    close() {
      active = false
      host.freeze(false)
    },
  }
}
