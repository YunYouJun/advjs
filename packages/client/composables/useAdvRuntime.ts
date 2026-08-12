import type {
  AdvRuntime,
  AdvRuntimeOptions,
  AdvRuntimePlugin,
  RuntimeTraceSubscriber,
} from '@advjs/core'
import type {
  JsonObject,
  JsonValue,
  RuntimeAddress,
  RuntimeEffect,
  RuntimeNode,
  RuntimeProgram,
  RuntimeSnapshot,
  RuntimeState,
  RuntimeTraceEntry,
  RuntimeUpdate,
} from '@advjs/types'
import type { DeepReadonly, Ref } from 'vue'
import { createAdvRuntime } from '@advjs/core'
import { readonly, shallowRef } from 'vue'

export interface AdvRuntimeHostInstallOptions {
  initialVariables?: JsonObject
  maxCheckpoints?: number
  maxTraceEntries?: number
  now?: () => number
  plugins?: readonly AdvRuntimePlugin[]
}

export interface CreateAdvRuntimeHostOptions extends AdvRuntimeHostInstallOptions {
  program: RuntimeProgram
  onEffects?: (effects: readonly RuntimeEffect[], state: Readonly<RuntimeState>) => void
  onState?: (
    state: Readonly<RuntimeState>,
    current: RuntimeNode | undefined,
    program: RuntimeProgram,
  ) => void
}

export interface AdvRuntimeHost {
  readonly state: DeepReadonly<Ref<RuntimeState>>
  readonly current: DeepReadonly<Ref<RuntimeNode | undefined>>
  readonly program: DeepReadonly<Ref<RuntimeProgram | undefined>>
  install: (program: RuntimeProgram, options?: AdvRuntimeHostInstallOptions) => void
  start: () => Promise<RuntimeUpdate>
  next: () => Promise<RuntimeUpdate>
  choose: (choiceId: string) => Promise<RuntimeUpdate>
  completeActivity: (result: JsonValue) => Promise<RuntimeUpdate>
  go: (target: RuntimeAddress | string) => Promise<RuntimeUpdate>
  back: () => RuntimeUpdate
  forward: () => RuntimeUpdate
  snapshot: () => RuntimeSnapshot
  restore: (snapshot: RuntimeSnapshot) => RuntimeUpdate
  trace: () => RuntimeTraceEntry[]
  subscribeTrace: (subscriber: RuntimeTraceSubscriber) => () => void
  dispose: () => void
}

function initialState(program: RuntimeProgram): RuntimeState {
  return {
    status: 'idle',
    cursor: structuredClone(program.entry),
    variables: {},
    stage: { background: '', bgm: '', cg: '', tachies: {} },
    choices: [],
    visited: [],
  }
}

export function createAdvRuntimeHost(options: CreateAdvRuntimeHostOptions): AdvRuntimeHost {
  const state = shallowRef<RuntimeState>(initialState(options.program))
  const current = shallowRef<RuntimeNode>()
  const program = shallowRef<RuntimeProgram>()
  let runtime: AdvRuntime | undefined
  let unsubscribe: (() => void) | undefined
  let unsubscribeTrace: (() => void) | undefined
  const traceSubscribers = new Set<RuntimeTraceSubscriber>()

  const sync = () => {
    if (!runtime || !program.value)
      return
    state.value = structuredClone(runtime.state)
    current.value = runtime.current
    options.onState?.(state.value, current.value, structuredClone(program.value))
  }

  const requireRuntime = (): AdvRuntime => {
    if (!runtime)
      throw new Error('ADV_RUNTIME_NOT_INSTALLED: Install a RuntimeProgram first')
    return runtime
  }

  const install = (
    installedProgram: RuntimeProgram,
    installOptions: AdvRuntimeHostInstallOptions = {},
  ) => {
    unsubscribe?.()
    unsubscribeTrace?.()
    program.value = structuredClone(installedProgram)
    const runtimeOptions: AdvRuntimeOptions = {
      program: installedProgram,
      initialVariables: installOptions.initialVariables ?? options.initialVariables,
      maxCheckpoints: installOptions.maxCheckpoints ?? options.maxCheckpoints,
      maxTraceEntries: installOptions.maxTraceEntries ?? options.maxTraceEntries,
      now: installOptions.now ?? options.now,
      plugins: installOptions.plugins ?? options.plugins,
    }
    runtime = createAdvRuntime(runtimeOptions)
    unsubscribe = runtime.subscribe((nextState, effects) => {
      options.onEffects?.(effects, nextState)
      sync()
    })
    unsubscribeTrace = runtime.subscribeTrace((entry) => {
      for (const subscriber of traceSubscribers)
        subscriber(structuredClone(entry))
    })
    sync()
  }

  install(options.program)

  return {
    state: readonly(state),
    current: readonly(current),
    program: readonly(program),
    install,
    start: () => requireRuntime().start(),
    next: () => requireRuntime().next(),
    choose: choiceId => requireRuntime().choose(choiceId),
    completeActivity: result => requireRuntime().completeActivity(result),
    go: target => requireRuntime().go(target),
    back: () => requireRuntime().back(),
    forward: () => requireRuntime().forward(),
    snapshot: () => requireRuntime().snapshot(),
    restore: snapshot => requireRuntime().restore(snapshot),
    trace: () => requireRuntime().trace(),
    subscribeTrace(subscriber) {
      traceSubscribers.add(subscriber)
      return () => traceSubscribers.delete(subscriber)
    },
    dispose() {
      unsubscribe?.()
      unsubscribeTrace?.()
      unsubscribe = undefined
      unsubscribeTrace = undefined
      traceSubscribers.clear()
      runtime = undefined
    },
  }
}
