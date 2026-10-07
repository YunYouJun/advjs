import type { RuntimeActionCall, RuntimeExpression } from '@advjs/types'
import type { CompileDiagnostic, CompileSourceLocation, RuntimeNodeInput, RuntimeProgramInput, RuntimeTargetInput } from './types'
import { evaluateRuntimeExpression, parseRuntimeExpression } from '../runtime/expression'
import { parseRuntimeTarget } from './address'

/** Interpolation is host-dependent, not an exact RuntimeProgram address. */
export function isDynamicRuntimeTarget(target: RuntimeTargetInput): boolean {
  return typeof target === 'string' && /\$\{|\{\{|%24%7B|%7B%7B/iu.test(target)
}

function variablePaths(value: unknown, prefix = '', paths = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return paths
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    paths.add(path)
    variablePaths(child, path, paths)
  }
  return paths
}

function expressionVariables(expression: RuntimeExpression): string[] {
  if (expression.type === 'variable')
    return [expression.path.join('.')]
  if (expression.type === 'unary')
    return expressionVariables(expression.argument)
  if (expression.type === 'binary')
    return [...expressionVariables(expression.left), ...expressionVariables(expression.right)]
  return []
}

function expression(value: string | RuntimeExpression | undefined): RuntimeExpression | undefined {
  try {
    return typeof value === 'string' ? parseRuntimeExpression(value) : value
  }
  catch {
    // The linker owns syntax diagnostics.
    return undefined
  }
}

/** Fold only closed expressions. Initial variable values can change during play. */
function condition(value: string | RuntimeExpression | undefined): boolean | undefined {
  if (value === undefined)
    return true
  const parsed = expression(value)
  if (!parsed || expressionVariables(parsed).length)
    return undefined
  try {
    return Boolean(evaluateRuntimeExpression(parsed, {}))
  }
  catch {
    return undefined
  }
}

/**
 * Analyze the same input the linker consumes, even when a target is broken.
 * Edges over-approximate execution; unknown exits can always reach an ending.
 * No path to an ending in this graph therefore proves a trapped flow region.
 */
export function analyzeRuntimeProgram(input: RuntimeProgramInput): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = []
  const nodes = new Map<string, RuntimeNodeInput>()
  const chapters = new Map(input.chapters.map(chapter => [chapter.id, chapter]))
  const key = (chapter: string, node: string) => `${chapter}#${node}`
  for (const chapter of input.chapters) {
    for (const node of chapter.nodes)
      nodes.set(key(chapter.id, node.id), node)
  }

  const report = (
    code: string,
    message: string,
    suggestion: string,
    source?: CompileSourceLocation,
    severity: 'error' | 'warning' = 'error',
    certainty: 'certain' | 'uncertain' = 'certain',
  ) => diagnostics.push({ code, severity, certainty, message, suggestion, source })

  // Built-in actions intentionally create their keys (including increment and
  // toggle). This is declaration checking, not definite-assignment analysis.
  const declared = variablePaths(input.staticAnalysis?.variables)
  const opaqueVariables = new Set<string>()
  let hasHostLogic = false
  const checkActions = (actions: RuntimeActionCall[] | undefined, source?: CompileSourceLocation) => {
    for (const action of actions ?? []) {
      if (!action.type.startsWith('variables/')) {
        hasHostLogic = true
        continue
      }
      const path = action.args?.key
      if (typeof path !== 'string' || path.split('.').some(part => !part || ['__proto__', 'prototype', 'constructor'].includes(part))) {
        report('ADV_STATIC_INVALID_VARIABLE_PATH', `Invalid variable action key: ${String(path)}`, 'Use a non-empty dot-separated key without prototype, constructor or __proto__.', source)
        continue
      }
      if (action.type === 'variables/remove')
        continue
      const parts = path.split('.')
      parts.forEach((_, index) => declared.add(parts.slice(0, index + 1).join('.')))
      if (action.type === 'variables/set')
        variablePaths(action.args?.value, path, declared)
      // Writes to parent objects may change their shape along another route.
      opaqueVariables.add(path)
    }
  }
  for (const node of nodes.values()) {
    hasHostLogic ||= node.kind.includes('/') || node.kind === '$dynamic'
    checkActions(node.actions, node.source)
    for (const choice of node.choices ?? [])
      checkActions(choice.actions, choice.source ?? node.source)
  }

  const checkCondition = (value: string | RuntimeExpression | undefined, source?: CompileSourceLocation) => {
    const parsed = expression(value)
    if (!parsed)
      return
    for (const path of new Set(expressionVariables(parsed))) {
      if (declared.has(path))
        continue
      const uncertain = hasHostLogic || [...opaqueVariables].some(parent => path.startsWith(`${parent}.`))
      report(uncertain ? 'ADV_STATIC_VARIABLE_UNCERTAIN' : 'ADV_STATIC_UNKNOWN_VARIABLE', uncertain
        ? `Variable "${path}" is not declared statically; its value may be supplied at runtime.`
        : `Variable "${path}" has no initial value or built-in action that defines it.`, 'Correct the variable path, declare it in gameConfig.variables, or verify the host/plugin that supplies it.', source, uncertain ? 'warning' : 'error', uncertain ? 'uncertain' : 'certain')
    }
    if (!expressionVariables(parsed).length) {
      try {
        evaluateRuntimeExpression(parsed, {})
      }
      catch (error) {
        report('ADV_STATIC_INVALID_CONSTANT_CONDITION', `Condition always fails to evaluate: ${String(error)}`, 'Use compatible literal types and avoid division by zero.', source)
      }
    }
  }

  const edges = new Map<string, Set<string>>()
  const exits = new Set<string>()
  const opaque = new Set<string>()
  for (const chapter of input.chapters) {
    for (const node of chapter.nodes) {
      const address = key(chapter.id, node.id)
      const successors = new Set<string>()
      edges.set(address, successors)
      const add = (target?: RuntimeTargetInput) => {
        if (!target) {
          exits.add(address)
          return
        }
        if (isDynamicRuntimeTarget(target)) {
          opaque.add(address)
          exits.add(address)
          return
        }
        const parsed = typeof target === 'string' ? parseRuntimeTarget(target, chapter.id) : { ok: true as const, target }
        const destination = parsed.ok ? key(parsed.target.chapterId, parsed.target.nodeId ?? chapters.get(parsed.target.chapterId)?.entry ?? '') : ''
        if (nodes.has(destination))
          successors.add(destination)
        else
          exits.add(address) // Broken target is already reported by the linker.
      }
      checkCondition(node.when, node.whenSource ?? node.source)
      for (const choice of node.choices ?? [])
        checkCondition(choice.when, choice.source ?? node.source)

      if (node.kind === '$dynamic' || node.kind.includes('/') || node.actions?.some(action => !action.type.startsWith('variables/'))
        || node.choices?.some(choice => choice.actions?.some(action => !action.type.startsWith('variables/')))) {
        opaque.add(address)
        exits.add(address)
        if (node.kind !== '$dynamic') {
          report('ADV_STATIC_FLOW_UNCERTAIN', `Flow at ${address} depends on host/plugin code.`, 'Verify the plugin action/activity result and its possible navigation during play.', node.source, 'warning', 'uncertain')
        }
      }

      const enabled = condition(node.when)
      if (enabled !== true)
        add(node.next)
      if (enabled === false)
        continue
      if (node.kind === 'end') {
        exits.add(address)
      }
      else if (node.kind === 'choices') {
        const choices = node.choices ?? []
        for (const choice of choices) {
          if (condition(choice.when) !== false)
            add(choice.target ?? node.next)
        }
        // Runtime skips a choice group when no choices are visible.
        if (!choices.some(choice => condition(choice.when) === true))
          add(node.next)
      }
      else {
        add(node.next)
      }
    }
  }

  const reachable = new Set<string>()
  const pending = [key(input.entry.chapterId, input.entry.nodeId)]
  while (pending.length) {
    const address = pending.pop()!
    if (reachable.has(address) || !nodes.has(address))
      continue
    reachable.add(address)
    pending.push(...edges.get(address) ?? [])
  }
  const unknownNavigation = [...opaque].some(address => reachable.has(address))
  const reverse = new Map<string, Set<string>>()
  for (const [from, destinations] of edges) {
    for (const destination of destinations) {
      const predecessors = reverse.get(destination) ?? new Set<string>()
      predecessors.add(from)
      reverse.set(destination, predecessors)
    }
  }
  const canEnd = new Set<string>()
  const ending = [...exits]
  while (ending.length) {
    const address = ending.pop()!
    if (canEnd.has(address))
      continue
    canEnd.add(address)
    ending.push(...reverse.get(address) ?? [])
  }
  for (const chapter of input.chapters) {
    const visited = chapter.nodes.filter(node => reachable.has(key(chapter.id, node.id)))
    if (!visited.length && !unknownNavigation) {
      report('ADV_STATIC_UNREACHABLE_CHAPTER', `Chapter "${chapter.id}" cannot be reached from the configured entry.`, 'Add a reachable choice linking to this chapter, change entryChapterId, or remove the unused chapter.', chapter.nodes.find(node => node.source)?.source, 'warning')
    }
    const trapped = visited.find(node => !canEnd.has(key(chapter.id, node.id)))
    if (trapped && !unknownNavigation) {
      report('ADV_STATIC_DEAD_END', `Flow at ${chapter.id}#${trapped.id} has no path to an ending; every possible route stays in a closed loop.`, 'Add an exit choice to an ending or a chapter that can finish. Natural chapter endings and skipped empty choices are valid.', trapped.source)
    }
  }
  return diagnostics
}
