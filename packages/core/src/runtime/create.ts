import type {
  JsonObject,
  JsonValue,
  RuntimeAddress,
  RuntimeCheckpoint,
  RuntimeEffect,
  RuntimeNode,
  RuntimeProgram,
  RuntimeSnapshot,
  RuntimeState,
  RuntimeUpdate,
} from '@advjs/types'
import type { AdvRuntimePlugin } from './registry'
import type { RuntimeCommand } from './transition'
import { isRuntimeIdentifier, parseRuntimeTarget } from '../compiler/address'
import { createRuntimeRegistry } from './registry'
import {
  createRuntimeSnapshot,
  runtimeStatesEqual,
  validateRuntimeSnapshot,
} from './snapshot'
import { createInitialRuntimeState, getRuntimeNode } from './state'
import { projectRuntimeNode, transitionRuntime } from './transition'

export interface AdvRuntimeOptions {
  program: RuntimeProgram
  initialVariables?: JsonObject
  maxCheckpoints?: number
  now?: () => number
  plugins?: readonly AdvRuntimePlugin[]
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
  go: (target: RuntimeAddress | string) => Promise<RuntimeUpdate>
  back: () => RuntimeUpdate
  snapshot: () => RuntimeSnapshot
  restore: (snapshot: RuntimeSnapshot) => RuntimeUpdate
  completeActivity: (result: JsonValue) => Promise<RuntimeUpdate>
  subscribe: (subscriber: RuntimeSubscriber) => () => void
}

function runtimeApiError(code: string, message: string): Error {
  return new Error(`${code}: ${message}`)
}

export function createAdvRuntime(options: AdvRuntimeOptions): AdvRuntime {
  const program = structuredClone(options.program)
  const maxCheckpoints = options.maxCheckpoints ?? 100
  const now = options.now ?? Date.now
  const registry = createRuntimeRegistry(options.plugins, program.requiredPlugins)
  if (!Number.isInteger(maxCheckpoints) || maxCheckpoints < 0)
    throw new TypeError('maxCheckpoints must be a non-negative integer')

  let state = createInitialRuntimeState(program, options.initialVariables)
  let checkpoints: RuntimeCheckpoint[] = []
  let checkpointSequence = 0
  const subscribers = new Set<RuntimeSubscriber>()

  const publish = (update: RuntimeUpdate): RuntimeUpdate => {
    const published = structuredClone(update)
    for (const subscriber of subscribers) {
      subscriber(
        structuredClone(published.state),
        structuredClone(published.effects),
      )
    }
    return published
  }

  const addCheckpoint = (checkpointState: RuntimeState): void => {
    if (maxCheckpoints === 0)
      return
    const previous = checkpoints.at(-1)
    if (previous && runtimeStatesEqual(previous.state, checkpointState))
      return

    const createdAt = now()
    if (!Number.isFinite(createdAt))
      throw new TypeError('now() must return a finite number')
    checkpoints.push({
      id: `checkpoint-${createdAt}-${++checkpointSequence}`,
      state: structuredClone(checkpointState),
      createdAt,
    })
    if (checkpoints.length > maxCheckpoints)
      checkpoints.splice(0, checkpoints.length - maxCheckpoints)
  }

  const shouldCheckpoint = (command: RuntimeCommand): boolean => {
    if (state.status === 'idle' || state.status === 'ended' || state.status === 'error')
      return false
    if (command.type === 'choose' || command.type === 'go' || command.type === 'complete-activity')
      return true
    if (command.type !== 'next')
      return false
    const current = getRuntimeNode(program, state.cursor)
    return Boolean(current && current.kind !== 'anchor' && current.kind !== 'effects' && current.kind !== 'end')
  }

  const dispatch = async (command: RuntimeCommand): Promise<RuntimeUpdate> => {
    const checkpoint = shouldCheckpoint(command) ? structuredClone(state) : undefined
    const update = transitionRuntime(program, state, command, registry)
    if (checkpoint)
      addCheckpoint(checkpoint)
    state = update.state
    return publish(update)
  }

  const resolveTarget = (target: RuntimeAddress | string): RuntimeAddress => {
    let chapterId: string
    let nodeId: string | undefined
    if (typeof target === 'string') {
      const parsed = parseRuntimeTarget(target, state.cursor.chapterId)
      if (!parsed.ok)
        throw runtimeApiError('ADV_RUNTIME_INVALID_TARGET', parsed.message)
      chapterId = parsed.target.chapterId
      nodeId = parsed.target.nodeId
    }
    else {
      chapterId = target.chapterId
      nodeId = target.nodeId
      if (!isRuntimeIdentifier(chapterId) || !isRuntimeIdentifier(nodeId)) {
        throw runtimeApiError(
          'ADV_RUNTIME_INVALID_TARGET',
          `Invalid runtime address: ${chapterId}#${nodeId}`,
        )
      }
    }

    const chapter = program.chapters[chapterId]
    nodeId ??= chapter?.entry
    if (!chapter || !nodeId || !chapter.nodes[nodeId]) {
      throw runtimeApiError(
        'ADV_RUNTIME_UNKNOWN_TARGET',
        `Unknown runtime target: ${chapterId}${nodeId ? `#${nodeId}` : ''}`,
      )
    }
    return { chapterId, nodeId }
  }

  return {
    get state() {
      return structuredClone(state)
    },
    get current() {
      const node = getRuntimeNode(program, state.cursor)
      return projectRuntimeNode(node, state)
    },
    start: () => dispatch({ type: 'start' }),
    next: () => dispatch({ type: 'next' }),
    choose: choiceId => dispatch({ type: 'choose', choiceId }),
    completeActivity: result => dispatch({ type: 'complete-activity', result: structuredClone(result) }),
    go: async target => dispatch({ type: 'go', target: resolveTarget(target) }),
    back() {
      const checkpoint = checkpoints.pop()
      if (!checkpoint) {
        throw runtimeApiError(
          'ADV_RUNTIME_NO_CHECKPOINT',
          'No runtime checkpoint is available',
        )
      }
      state = structuredClone(checkpoint.state)
      return publish({
        state,
        effects: [{ type: 'runtime.back' }],
      })
    },
    snapshot: () => createRuntimeSnapshot(program, state, checkpoints, now()),
    restore(snapshot) {
      const restored = validateRuntimeSnapshot(snapshot, program)
      state = restored.state
      checkpoints = restored.checkpoints
      checkpointSequence = checkpoints.length
      const effects: RuntimeEffect[] = [{ type: 'runtime.restore' }]
      if (state.pendingActivity) {
        effects.push({
          type: 'activity.request',
          payload: structuredClone(state.pendingActivity) as unknown as JsonValue,
        })
      }
      return publish({
        state,
        effects,
      })
    },
    subscribe(subscriber) {
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    },
  }
}
