import type {
  JsonObject,
  RuntimeAddress,
  RuntimeEffect,
  RuntimeNode,
  RuntimeProgram,
  RuntimeState,
  RuntimeUpdate,
} from '@advjs/types'
import type { RuntimeCommand } from './transition'
import { createInitialRuntimeState, getRuntimeNode } from './state'
import { transitionRuntime } from './transition'

export interface AdvRuntimeOptions {
  program: RuntimeProgram
  initialVariables?: JsonObject
}

export type RuntimeSubscriber = (
  state: Readonly<RuntimeState>,
  effects: readonly RuntimeEffect[],
) => void

export interface AdvRuntime {
  readonly state: Readonly<RuntimeState>
  readonly current: RuntimeNode | undefined
  start: () => Promise<RuntimeUpdate>
  next: () => Promise<RuntimeUpdate>
  choose: (choiceId: string) => Promise<RuntimeUpdate>
  go: (target: RuntimeAddress) => Promise<RuntimeUpdate>
  subscribe: (subscriber: RuntimeSubscriber) => () => void
}

export function createAdvRuntime(options: AdvRuntimeOptions): AdvRuntime {
  const program = structuredClone(options.program)
  let state = createInitialRuntimeState(program, options.initialVariables)
  const subscribers = new Set<RuntimeSubscriber>()

  const dispatch = async (command: RuntimeCommand): Promise<RuntimeUpdate> => {
    const update = transitionRuntime(program, state, command)
    state = update.state
    const published = structuredClone(update)
    for (const subscriber of subscribers) {
      subscriber(
        structuredClone(published.state),
        structuredClone(published.effects),
      )
    }
    return published
  }

  return {
    get state() {
      return structuredClone(state)
    },
    get current() {
      const node = getRuntimeNode(program, state.cursor)
      return node ? structuredClone(node) : undefined
    },
    start: () => dispatch({ type: 'start' }),
    next: () => dispatch({ type: 'next' }),
    choose: choiceId => dispatch({ type: 'choose', choiceId }),
    go: target => dispatch({ type: 'go', target }),
    subscribe(subscriber) {
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    },
  }
}
