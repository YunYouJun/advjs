import type {
  JsonObject,
  JsonValue,
  RuntimeAddress,
  RuntimeChoice,
  RuntimeEffect,
  RuntimeProgram,
  RuntimeState,
  RuntimeUpdate,
} from '@advjs/types'
import type { RuntimeRegistry } from './registry'
import { runtimeConditionMatches } from './expression'
import { createRuntimeRegistry } from './registry'
import { getRuntimeNode, runtimeAddressKey } from './state'

export type RuntimeCommand
  = | { type: 'start' }
    | { type: 'next' }
    | { type: 'choose', choiceId: string }
    | { type: 'go', target: RuntimeAddress }
    | { type: 'complete-activity', result: JsonValue }

interface Operation extends JsonObject {
  type: string
}

function moveToNext(state: RuntimeState, next?: RuntimeAddress): void {
  if (next)
    state.cursor = structuredClone(next)
  else
    state.status = 'ended'
}

function applyOperation(state: RuntimeState, operation: Operation): RuntimeEffect {
  if (operation.type === 'background') {
    const url = String(operation.url ?? operation.name ?? '')
    state.stage.background = url
    return { type: 'stage.background', payload: { url } }
  }

  if (operation.type === 'bgm') {
    const value = operation.stop ? '' : String(operation.name ?? operation.src ?? '')
    state.stage.bgm = value
    return { type: 'stage.bgm', payload: { value } }
  }

  if (operation.type === 'tachie') {
    const enter = Array.isArray(operation.enter) ? operation.enter : [operation.enter]
    for (const item of enter) {
      if (typeof item === 'string') {
        state.stage.tachies[item] = { status: '' }
      }
      else if (item && typeof item === 'object' && !Array.isArray(item)) {
        const name = String(item.name ?? '')
        if (name)
          state.stage.tachies[name] = { status: String(item.status ?? '') }
      }
    }
    const exits = Array.isArray(operation.exit) ? operation.exit : []
    for (const name of exits)
      delete state.stage.tachies[String(name)]
    return { type: 'stage.tachie', payload: structuredClone(operation) }
  }

  return { type: `stage.${operation.type}`, payload: structuredClone(operation) }
}

function enterUntilPause(
  program: RuntimeProgram,
  state: RuntimeState,
  registry: RuntimeRegistry,
): RuntimeUpdate {
  const effects: RuntimeEffect[] = []
  let silentSteps = 0

  while (silentSteps <= 1000) {
    const node = getRuntimeNode(program, state.cursor)
    if (!node) {
      state.status = 'error'
      state.error = {
        code: 'ADV_RUNTIME_NODE_NOT_FOUND',
        message: `Node not found: ${runtimeAddressKey(state.cursor)}`,
      }
      return { state, effects }
    }

    if (!runtimeConditionMatches(node.when, state.variables)) {
      moveToNext(state, node.next)
      if (state.status === 'ended')
        return { state, effects }
      silentSteps++
      continue
    }

    const address = runtimeAddressKey(state.cursor)
    if (!state.visited.includes(address))
      state.visited.push(address)

    if (node.actions?.length)
      registry.runActions(state, node.actions)

    if (registry.runNode(state, node, effects)) {
      if (state.status === 'waiting-activity')
        return { state, effects }
      moveToNext(state, node.next)
      if (state.status === 'ended')
        return { state, effects }
      silentSteps++
      continue
    }

    if (node.kind.includes('/')) {
      state.status = 'error'
      state.error = {
        code: 'ADV_RUNTIME_UNKNOWN_NODE',
        message: `No plugin registered runtime node: ${node.kind}`,
      }
      return { state, effects }
    }

    if (node.kind === 'anchor') {
      moveToNext(state, node.next)
      if (state.status === 'ended')
        return { state, effects }
      silentSteps++
      continue
    }

    if (node.kind === 'effects') {
      const data = node.data as { operations?: JsonValue[] } | undefined
      for (const value of data?.operations ?? []) {
        if (value && typeof value === 'object' && !Array.isArray(value))
          effects.push(applyOperation(state, value as Operation))
      }
      moveToNext(state, node.next)
      if (state.status === 'ended')
        return { state, effects }
      silentSteps++
      continue
    }

    if (node.kind === 'actions') {
      moveToNext(state, node.next)
      if (state.status === 'ended')
        return { state, effects }
      silentSteps++
      continue
    }

    if (node.kind === 'choices' && visibleRuntimeChoices(node.data, state).length === 0) {
      moveToNext(state, node.next)
      if (state.status === 'ended')
        return { state, effects }
      silentSteps++
      continue
    }

    if (node.kind === 'choices')
      state.status = 'waiting-choice'
    else if (node.kind === 'end')
      state.status = 'ended'
    else
      state.status = 'playing'

    return { state, effects }
  }

  state.status = 'error'
  state.error = {
    code: 'ADV_RUNTIME_SILENT_LOOP',
    message: 'Runtime exceeded 1000 consecutive silent nodes',
  }
  return { state, effects }
}

function readChoices(nodeData: JsonValue | undefined): RuntimeChoice[] {
  if (!nodeData || typeof nodeData !== 'object' || Array.isArray(nodeData))
    return []
  const options = nodeData.options
  return Array.isArray(options) ? options as unknown as RuntimeChoice[] : []
}

export function visibleRuntimeChoices(
  nodeData: JsonValue | undefined,
  state: Readonly<RuntimeState>,
): RuntimeChoice[] {
  return readChoices(nodeData).filter(choice => (
    runtimeConditionMatches(choice.when, state.variables)
  ))
}

export function projectRuntimeNode(
  node: RuntimeProgram['chapters'][string]['nodes'][string] | undefined,
  state: Readonly<RuntimeState>,
) {
  if (!node)
    return undefined
  const projected = structuredClone(node)
  if (projected.kind === 'choices') {
    const data = structuredClone(projected.data ?? {})
    data.options = visibleRuntimeChoices(projected.data, state) as unknown as JsonValue
    projected.data = data
  }
  return projected
}

export function transitionRuntime(
  program: RuntimeProgram,
  previous: RuntimeState,
  command: RuntimeCommand,
  registry: RuntimeRegistry = createRuntimeRegistry(),
): RuntimeUpdate {
  const state = structuredClone(previous)

  if (command.type === 'start')
    return enterUntilPause(program, state, registry)

  if (command.type === 'go') {
    state.cursor = structuredClone(command.target)
    return enterUntilPause(program, state, registry)
  }

  if (command.type === 'complete-activity') {
    const effects: RuntimeEffect[] = []
    const pending = state.pendingActivity
    if (state.status !== 'waiting-activity' || !pending)
      throw new Error('ADV_RUNTIME_NO_PENDING_ACTIVITY: No activity is waiting for a result')
    registry.completeActivity(state, pending, command.result)
    delete state.pendingActivity
    effects.push({
      type: 'activity.complete',
      payload: {
        id: pending.id,
        type: pending.type,
        result: structuredClone(command.result),
      },
    })
    const activityNode = getRuntimeNode(program, pending.node)
    moveToNext(state, activityNode?.next)
    if (!activityNode?.next)
      return { state, effects }
    const next = enterUntilPause(program, state, registry)
    return { state: next.state, effects: [...effects, ...next.effects] }
  }

  const current = getRuntimeNode(program, state.cursor)
  if (!current)
    return enterUntilPause(program, state, registry)

  if (command.type === 'next') {
    if (state.status === 'waiting-choice')
      throw new Error('A choice must be selected before advancing')
    if (state.status === 'waiting-activity')
      throw new Error('ADV_RUNTIME_ACTIVITY_PENDING: The activity must be completed before advancing')
    moveToNext(state, current.next)
    return state.status === 'ended' ? { state, effects: [] } : enterUntilPause(program, state, registry)
  }

  if (current.kind !== 'choices')
    throw new Error(`Cannot choose from node kind: ${current.kind}`)

  const choice = visibleRuntimeChoices(current.data, state).find(item => item.id === command.choiceId)
  if (!choice)
    throw new Error(`Unknown choice: ${command.choiceId}`)

  state.choices.push({
    node: structuredClone(state.cursor),
    choiceId: choice.id,
  })
  if (choice.actions?.length)
    registry.runActions(state, choice.actions)
  moveToNext(state, choice.target ?? current.next)
  return state.status === 'ended' ? { state, effects: [] } : enterUntilPause(program, state, registry)
}

export { createInitialRuntimeState } from './state'
