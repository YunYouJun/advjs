import type {
  JsonObject,
  JsonValue,
  RuntimeActionCall,
  RuntimeEffect,
  RuntimeNode,
  RuntimePendingActivity,
  RuntimeProgram,
  RuntimeState,
} from '@advjs/types'

export interface AdvActionContext {
  state: RuntimeState
}

export type AdvActionHandler = (
  context: AdvActionContext,
  args: Readonly<JsonObject>,
) => void

export interface AdvNodeContext {
  state: RuntimeState
  node: RuntimeNode
  effects: RuntimeEffect[]
  activity: (name: string, input?: JsonObject) => void
}

export type AdvNodeHandler = (context: AdvNodeContext) => void

export interface AdvActivityContext {
  state: RuntimeState
  input: Readonly<JsonObject>
  node: RuntimePendingActivity['node']
}

export type AdvActivityHandler = (
  context: AdvActivityContext,
  result: JsonValue,
) => void

export interface AdvRuntimePlugin {
  name: string
  version: string
  actions?: Record<string, AdvActionHandler>
  nodes?: Record<string, AdvNodeHandler>
  activities?: Record<string, AdvActivityHandler>
}

export interface RuntimeRegistry {
  readonly plugins: ReadonlyMap<string, AdvRuntimePlugin>
  runActions: (state: RuntimeState, actions: readonly RuntimeActionCall[]) => void
  runNode: (state: RuntimeState, node: RuntimeNode, effects: RuntimeEffect[]) => boolean
  completeActivity: (
    state: RuntimeState,
    pending: RuntimePendingActivity,
    result: JsonValue,
  ) => void
}

export interface RuntimePluginDiagnostic {
  code: string
  severity: 'error'
  message: string
  address?: { chapterId: string, nodeId: string }
}

const blockedPathSegments = new Set(['__proto__', 'prototype', 'constructor'])

function registryError(code: string, message: string): Error {
  return new Error(`${code}: ${message}`)
}

function pathFromArgs(args: Readonly<JsonObject>): string[] {
  if (typeof args.key !== 'string' || !args.key)
    throw registryError('ADV_RUNTIME_INVALID_ACTION', 'Variable action requires a key')
  const path = args.key.split('.')
  if (path.some(segment => !segment || blockedPathSegments.has(segment)))
    throw registryError('ADV_RUNTIME_INVALID_ACTION', `Unsafe variable path: ${args.key}`)
  return path
}

function parentAtPath(variables: JsonObject, path: string[]): [JsonObject, string] {
  let parent = variables
  for (const segment of path.slice(0, -1)) {
    const child = parent[segment]
    if (child === undefined) {
      parent[segment] = {}
      parent = parent[segment] as JsonObject
    }
    else if (child && typeof child === 'object' && !Array.isArray(child)) {
      parent = child
    }
    else {
      throw registryError('ADV_RUNTIME_INVALID_ACTION', `Variable path ${path.join('.')} is not an object`)
    }
  }
  return [parent, path.at(-1)!]
}

function variableAction(
  operation: 'set' | 'increment' | 'decrement' | 'toggle' | 'push' | 'remove',
): AdvActionHandler {
  return ({ state }, args) => {
    const path = pathFromArgs(args)
    const [parent, key] = parentAtPath(state.variables, path)
    const current = parent[key]
    if (operation === 'set') {
      parent[key] = structuredClone(args.value ?? null)
      return
    }
    if (operation === 'increment' || operation === 'decrement') {
      const value = current === undefined ? 0 : current
      const by = args.by === undefined ? 1 : args.by
      if (typeof value !== 'number' || typeof by !== 'number')
        throw registryError('ADV_RUNTIME_INVALID_ACTION', `${operation} requires numeric values`)
      parent[key] = operation === 'increment' ? value + by : value - by
      return
    }
    if (operation === 'toggle') {
      if (current !== undefined && typeof current !== 'boolean')
        throw registryError('ADV_RUNTIME_INVALID_ACTION', 'toggle requires a boolean value')
      parent[key] = !current
      return
    }
    if (operation === 'push') {
      const values = current === undefined ? [] : current
      if (!Array.isArray(values))
        throw registryError('ADV_RUNTIME_INVALID_ACTION', 'push requires an array value')
      parent[key] = [...values, structuredClone(args.value ?? null)]
      return
    }
    if (!Array.isArray(current))
      throw registryError('ADV_RUNTIME_INVALID_ACTION', 'remove requires an array value')
    if (typeof args.index === 'number') {
      parent[key] = current.filter((_, index) => index !== args.index)
      return
    }
    const serialized = JSON.stringify(args.value ?? null)
    parent[key] = current.filter(value => JSON.stringify(value) !== serialized)
  }
}

const builtinActions: Record<string, AdvActionHandler> = {
  'variables/set': variableAction('set'),
  'variables/increment': variableAction('increment'),
  'variables/decrement': variableAction('decrement'),
  'variables/toggle': variableAction('toggle'),
  'variables/push': variableAction('push'),
  'variables/remove': variableAction('remove'),
}

function assertJson(
  value: unknown,
  path = 'state.variables',
  ancestors = new Set<object>(),
): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw registryError('ADV_RUNTIME_NON_JSON_STATE', `${path} contains a non-finite number`)
    return
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value))
      throw registryError('ADV_RUNTIME_NON_JSON_STATE', `${path} contains a circular reference`)
    ancestors.add(value)
    value.forEach((child, index) => assertJson(child, `${path}[${index}]`, ancestors))
    ancestors.delete(value)
    return
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype)
    throw registryError('ADV_RUNTIME_NON_JSON_STATE', `${path} must contain JSON data only`)
  if (ancestors.has(value))
    throw registryError('ADV_RUNTIME_NON_JSON_STATE', `${path} contains a circular reference`)
  ancestors.add(value)
  for (const [key, child] of Object.entries(value))
    assertJson(child, `${path}.${key}`, ancestors)
  ancestors.delete(value)
}

export function defineAdvPlugin<const T extends AdvRuntimePlugin>(plugin: T): T {
  return plugin
}

function pluginDiagnostic(error: unknown): RuntimePluginDiagnostic {
  const message = error instanceof Error ? error.message : String(error)
  const match = /^([A-Z][A-Z0-9_]+): (.*)$/u.exec(message)
  return {
    code: match?.[1] ?? 'ADV_RUNTIME_INVALID_PLUGIN',
    severity: 'error',
    message: match?.[2] ?? message,
  }
}

export function validateRuntimeProgramPlugins(
  program: RuntimeProgram,
  plugins: readonly AdvRuntimePlugin[] = [],
): RuntimePluginDiagnostic[] {
  try {
    createRuntimeRegistry(plugins, program.requiredPlugins)
  }
  catch (error) {
    return [pluginDiagnostic(error)]
  }

  const actions = new Set(Object.keys(builtinActions))
  const nodes = new Set<string>()
  for (const plugin of plugins) {
    for (const name of Object.keys(plugin.actions ?? {}))
      actions.add(`${plugin.name}/${name}`)
    for (const name of Object.keys(plugin.nodes ?? {}))
      nodes.add(`${plugin.name}/${name}`)
  }

  const diagnostics: RuntimePluginDiagnostic[] = []
  const validateActions = (
    calls: readonly RuntimeActionCall[] | undefined,
    address: { chapterId: string, nodeId: string },
  ) => {
    for (const call of calls ?? []) {
      if (!actions.has(call.type)) {
        diagnostics.push({
          code: 'ADV_RUNTIME_UNKNOWN_ACTION',
          severity: 'error',
          message: `Unknown action at ${address.chapterId}#${address.nodeId}: ${call.type}`,
          address,
        })
      }
    }
  }

  for (const chapter of Object.values(program.chapters)) {
    for (const nodeId of chapter.order) {
      const node = chapter.nodes[nodeId]
      const address = { chapterId: chapter.id, nodeId }
      if (node.kind.includes('/') && !nodes.has(node.kind)) {
        diagnostics.push({
          code: 'ADV_RUNTIME_UNKNOWN_NODE',
          severity: 'error',
          message: `Unknown plugin node at ${chapter.id}#${nodeId}: ${node.kind}`,
          address,
        })
      }
      validateActions(node.actions, address)
      const options = node.data?.options
      if (Array.isArray(options)) {
        for (const option of options) {
          if (option && typeof option === 'object' && !Array.isArray(option) && Array.isArray(option.actions))
            validateActions(option.actions as unknown as RuntimeActionCall[], address)
        }
      }
    }
  }

  return diagnostics
}

export function createRuntimeRegistry(
  plugins: readonly AdvRuntimePlugin[] = [],
  requiredPlugins: Readonly<Record<string, string>> = {},
): RuntimeRegistry {
  const installed = new Map<string, AdvRuntimePlugin>()
  const actions = new Map<string, AdvActionHandler>(Object.entries(builtinActions))
  const nodes = new Map<string, { plugin: string, handler: AdvNodeHandler }>()
  const activities = new Map<string, AdvActivityHandler>()

  for (const plugin of plugins) {
    if (!/^[a-z][a-z0-9-]*$/u.test(plugin.name) || !plugin.version)
      throw registryError('ADV_RUNTIME_INVALID_PLUGIN', `Invalid plugin identity: ${plugin.name}`)
    if (installed.has(plugin.name))
      throw registryError('ADV_RUNTIME_PLUGIN_CONFLICT', `Plugin already installed: ${plugin.name}`)
    installed.set(plugin.name, plugin)
    for (const [name, handler] of Object.entries(plugin.actions ?? {})) {
      if (!/^[a-z][a-z0-9-]*$/u.test(name))
        throw registryError('ADV_RUNTIME_INVALID_PLUGIN', `Invalid action name: ${plugin.name}/${name}`)
      const capability = `${plugin.name}/${name}`
      if (actions.has(capability))
        throw registryError('ADV_RUNTIME_PLUGIN_CONFLICT', `Action already registered: ${capability}`)
      actions.set(capability, handler)
    }
    for (const [name, handler] of Object.entries(plugin.nodes ?? {})) {
      if (!/^[a-z][a-z0-9-]*$/u.test(name))
        throw registryError('ADV_RUNTIME_INVALID_PLUGIN', `Invalid node name: ${plugin.name}/${name}`)
      const capability = `${plugin.name}/${name}`
      if (nodes.has(capability))
        throw registryError('ADV_RUNTIME_PLUGIN_CONFLICT', `Node already registered: ${capability}`)
      nodes.set(capability, { plugin: plugin.name, handler })
    }
    for (const [name, handler] of Object.entries(plugin.activities ?? {})) {
      if (!/^[a-z][a-z0-9-]*$/u.test(name))
        throw registryError('ADV_RUNTIME_INVALID_PLUGIN', `Invalid activity name: ${plugin.name}/${name}`)
      const capability = `${plugin.name}/${name}`
      if (activities.has(capability))
        throw registryError('ADV_RUNTIME_PLUGIN_CONFLICT', `Activity already registered: ${capability}`)
      activities.set(capability, handler)
    }
  }

  for (const [name, version] of Object.entries(requiredPlugins)) {
    const plugin = installed.get(name)
    if (!plugin)
      throw registryError('ADV_RUNTIME_MISSING_PLUGIN', `Required plugin is not installed: ${name}@${version}`)
    if (version !== '*' && plugin.version !== version) {
      throw registryError(
        'ADV_RUNTIME_PLUGIN_VERSION_MISMATCH',
        `Plugin ${name} requires ${version}, installed ${plugin.version}`,
      )
    }
  }

  return {
    plugins: installed,
    runActions(state, calls) {
      for (const call of calls) {
        const handler = actions.get(call.type)
        if (!handler)
          throw registryError('ADV_RUNTIME_UNKNOWN_ACTION', `Unknown action: ${call.type}`)
        handler({ state }, structuredClone(call.args ?? {}))
        assertJson(state.variables)
      }
    },
    runNode(state, node, effects) {
      const registered = nodes.get(node.kind)
      if (!registered)
        return false
      registered.handler({
        state,
        node: structuredClone(node),
        effects,
        activity(name, input = {}) {
          const type = name.includes('/') ? name : `${registered.plugin}/${name}`
          if (!activities.has(type))
            throw registryError('ADV_RUNTIME_UNKNOWN_ACTIVITY', `Unknown activity: ${type}`)
          assertJson(input, 'activity.input')
          const pending: RuntimePendingActivity = {
            id: `${state.cursor.chapterId}#${state.cursor.nodeId}`,
            type,
            input: structuredClone(input),
            node: structuredClone(state.cursor),
          }
          state.pendingActivity = pending
          state.status = 'waiting-activity'
          effects.push({
            type: 'activity.request',
            payload: structuredClone(pending) as unknown as JsonValue,
          })
        },
      })
      assertJson(state.variables)
      return true
    },
    completeActivity(state, pending, result) {
      assertJson(result, 'activity.result')
      const handler = activities.get(pending.type)
      if (!handler)
        throw registryError('ADV_RUNTIME_UNKNOWN_ACTIVITY', `Unknown activity: ${pending.type}`)
      handler({
        state,
        input: structuredClone(pending.input),
        node: structuredClone(pending.node),
      }, structuredClone(result))
      assertJson(state.variables)
    },
  }
}
