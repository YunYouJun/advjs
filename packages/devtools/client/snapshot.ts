import type { AdvGameConfig, RuntimeNode, RuntimeProgram, RuntimeState, RuntimeTraceEntry } from '@advjs/types'
import type { DevToolsDiagnostic, DevToolsResource, DevToolsSnapshot } from '../src/types'

export interface DevToolsContext {
  /** Observe using the host Vue instance, independent of the inspector bundle. */
  observe: (callback: () => void) => () => void
  runtime: {
    state: { readonly value: Readonly<RuntimeState> }
    current: { readonly value: RuntimeNode | undefined }
    program: { readonly value: RuntimeProgram | undefined }
    trace: () => RuntimeTraceEntry[]
    subscribeTrace: (callback: () => void) => () => void
  }
  gameConfig: { readonly value: AdvGameConfig }
  compileDiagnostics: { readonly value: readonly DevToolsDiagnostic[] }
}

export function createDevToolsSnapshot(context: DevToolsContext, url: string): DevToolsSnapshot {
  const game = context.gameConfig.value
  const program = context.runtime.program.value
  const resources: DevToolsResource[] = []
  for (const [type, items] of [
    ['chapter', game.chapters],
    ['character', game.characters],
    ['scene', game.scenes],
  ] as const) {
    for (const item of items ?? [])
      resources.push({ type, id: item.id, name: ('name' in item ? item.name : 'title' in item ? item.title : item.id) ?? item.id })
  }
  const library = game.bgm?.library
  if (library && typeof library === 'object' && !Array.isArray(library)) {
    for (const id of Object.keys(library))
      resources.push({ type: 'bgm', id, name: id })
  }
  for (const item of game.gallery?.items ?? [])
    resources.push({ type: 'cg', id: item.id, name: item.title ?? item.id })
  return JSON.parse(JSON.stringify({
    title: game.title || 'ADV.JS',
    url,
    state: context.runtime.state.value,
    current: context.runtime.current.value,
    program: program && {
      id: program.id,
      hash: program.hash,
      chapters: Object.keys(program.chapters).length,
      nodes: Object.values(program.chapters).reduce((sum, chapter) => sum + chapter.order.length, 0),
    },
    trace: context.runtime.trace().slice(-100),
    resources,
    diagnostics: context.compileDiagnostics.value.map(({ code, severity, message, source }) => ({ code, severity, message, source })),
  })) as DevToolsSnapshot
}

/** Batch reactive and trace updates, and release both subscriptions when replaced. */
export function attachDevToolsRuntime(context: DevToolsContext, publish: (snapshot: DevToolsSnapshot) => void, url: () => string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const send = () => {
    timer = undefined
    publish(createDevToolsSnapshot(context, url()))
  }
  const schedule = () => {
    if (timer === undefined)
      timer = setTimeout(send, 100)
  }
  const stopWatch = context.observe(schedule)
  schedule()
  const stopTrace = context.runtime.subscribeTrace(schedule)
  return {
    refresh: schedule,
    dispose() {
      stopWatch()
      stopTrace()
      clearTimeout(timer)
      timer = undefined
    },
  }
}
