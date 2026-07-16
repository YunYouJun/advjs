import type {
  AdvRuntime,
  AdvRuntimeOptions,
} from '@advjs/core'
import type {
  JsonObject,
  RuntimeAddress,
  RuntimeEffect,
  RuntimeNode,
  RuntimeProgram,
  RuntimeSnapshot,
  RuntimeState,
  RuntimeUpdate,
} from '@advjs/types'
import type { DeepReadonly, Ref } from 'vue'
import { createAdvRuntime } from '@advjs/core'
import { readonly, shallowRef } from 'vue'

export interface AdvRuntimeHostInstallOptions {
  initialVariables?: JsonObject
  maxCheckpoints?: number
  now?: () => number
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
  go: (target: RuntimeAddress | string) => Promise<RuntimeUpdate>
  back: () => RuntimeUpdate
  snapshot: () => RuntimeSnapshot
  restore: (snapshot: RuntimeSnapshot) => RuntimeUpdate
  dispose: () => void
}

function initialState(program: RuntimeProgram): RuntimeState {
  return {
    status: 'idle',
    cursor: structuredClone(program.entry),
    variables: {},
    stage: { background: '', bgm: '', tachies: {} },
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
    program.value = structuredClone(installedProgram)
    const runtimeOptions: AdvRuntimeOptions = {
      program: installedProgram,
      initialVariables: installOptions.initialVariables ?? options.initialVariables,
      maxCheckpoints: installOptions.maxCheckpoints ?? options.maxCheckpoints,
      now: installOptions.now ?? options.now,
    }
    runtime = createAdvRuntime(runtimeOptions)
    unsubscribe = runtime.subscribe((nextState, effects) => {
      sync()
      options.onEffects?.(effects, nextState)
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
    go: target => requireRuntime().go(target),
    back: () => requireRuntime().back(),
    snapshot: () => requireRuntime().snapshot(),
    restore: snapshot => requireRuntime().restore(snapshot),
    dispose() {
      unsubscribe?.()
      unsubscribe = undefined
      runtime = undefined
    },
  }
}
