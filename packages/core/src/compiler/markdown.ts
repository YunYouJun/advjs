import type {
  AdvAst,
  JsonObject,
  JsonValue,
  RuntimeActionCall,
  RuntimeProgram,
} from '@advjs/types'
import type {
  CompileDiagnostic,
  CompileResult,
  CompileSourceLocation,
  RuntimeChapterInput,
  RuntimeNodeInput,
} from './types'
import { parseAst } from '@advjs/parser'
import { linkRuntimeProgram } from './link'

export interface MarkdownChapterSource {
  id: string
  title?: string
  content: string
  sourcePath?: string
}

export interface MarkdownProgramSource {
  id: string
  chapters: MarkdownChapterSource[]
  requiredPlugins?: Record<string, string>
  resources?: MarkdownResourceCatalog
}

export interface MarkdownResourceCatalog {
  backgrounds?: string[]
  bgms?: string[]
  cgs?: string[]
  /** Character id/name/alias to available tachie statuses. */
  tachies?: Record<string, string[]>
}

function phrasingText(children: Array<AdvAst.PhrasingContent | AdvAst.Dialog>): string {
  return children.map((child) => {
    if ('value' in child)
      return String(child.value)
    return phrasingText(child.children)
  }).join('')
}

function json(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

const capabilityPattern = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/u
const transitionPresets = new Set([
  'cut',
  'crossfade',
  'fade',
  'dissolve',
  'wipe-left',
  'wipe-right',
  'rise',
  'flash-white',
])

function validateDuration(
  value: unknown,
  diagnostics: CompileDiagnostic[],
  source: CompileSourceLocation | undefined,
): void {
  if (value === undefined)
    return
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 60_000) {
    diagnostics.push({
      code: 'ADV_RUNTIME_INVALID_TRANSITION_DURATION',
      severity: 'error',
      message: 'Transition duration must be a finite number between 0 and 60000 milliseconds',
      source,
    })
  }
}

function validateTransition(
  value: unknown,
  diagnostics: CompileDiagnostic[],
  source: CompileSourceLocation | undefined,
): void {
  const name = typeof value === 'string'
    ? value
    : isRecord(value) && typeof value.name === 'string'
      ? value.name
      : undefined
  if (!name || !transitionPresets.has(name)) {
    diagnostics.push({
      code: 'ADV_RUNTIME_UNKNOWN_TRANSITION',
      severity: 'error',
      message: `Unknown scene transition: ${name ?? String(value)}`,
      source,
    })
  }
  if (isRecord(value))
    validateDuration(value.duration, diagnostics, source)
}

function validateEffectOperation(
  value: JsonValue,
  diagnostics: CompileDiagnostic[],
  source: CompileSourceLocation | undefined,
  resources?: MarkdownResourceCatalog,
): void {
  if (!isRecord(value) || typeof value.type !== 'string')
    return

  if (value.type === 'transition') {
    validateTransition(value, diagnostics, source)
    return
  }
  if (value.type === 'background') {
    if (value.transition !== undefined)
      validateTransition(value.transition, diagnostics, source)
    if (typeof value.name === 'string' && resources?.backgrounds && !resources.backgrounds.includes(value.name)) {
      diagnostics.push({
        code: 'ADV_RUNTIME_UNKNOWN_BACKGROUND',
        severity: 'error',
        message: `Unknown background: ${value.name}`,
        source,
      })
    }
  }
  if (value.type === 'cg') {
    const action = value.action ?? 'show'
    if (action !== 'show' && action !== 'hide') {
      diagnostics.push({
        code: 'ADV_RUNTIME_INVALID_CG_ACTION',
        severity: 'error',
        message: 'CG action must be show or hide',
        source,
      })
    }
    if (action !== 'hide' && (typeof value.id !== 'string' || !value.id.trim())) {
      diagnostics.push({
        code: 'ADV_RUNTIME_MISSING_CG_ID',
        severity: 'error',
        message: 'A CG show operation requires a stable id',
        source,
      })
    }
    if (value.transition !== undefined)
      validateTransition(value.transition, diagnostics, source)
    if (action !== 'hide' && typeof value.id === 'string' && resources?.cgs && !resources.cgs.includes(value.id)) {
      diagnostics.push({
        code: 'ADV_RUNTIME_UNKNOWN_CG',
        severity: 'error',
        message: `Unknown CG: ${value.id}`,
        source,
      })
    }
  }
  if (value.type === 'bgm') {
    if (isRecord(value.fade)) {
      for (const timing of [value.fade.in, value.fade.out]) {
        if (timing !== undefined && (typeof timing !== 'number' || !Number.isFinite(timing) || timing < 0)) {
          diagnostics.push({
            code: 'ADV_RUNTIME_INVALID_BGM_FADE',
            severity: 'error',
            message: 'BGM fade timings must be non-negative finite milliseconds',
            source,
          })
          break
        }
      }
    }
    if (!value.stop && typeof value.name === 'string' && resources?.bgms && !resources.bgms.includes(value.name)) {
      diagnostics.push({
        code: 'ADV_RUNTIME_UNKNOWN_BGM',
        severity: 'error',
        message: `Unknown BGM: ${value.name}`,
        source,
      })
    }
  }
  if (value.type === 'tachie' && resources?.tachies) {
    const entries = Array.isArray(value.enter) ? value.enter : [value.enter]
    for (const item of entries) {
      const name = typeof item === 'string'
        ? item
        : isRecord(item) && typeof item.name === 'string'
          ? item.name
          : ''
      if (!name)
        continue
      const statuses = resources.tachies[name]
      if (!statuses) {
        diagnostics.push({
          code: 'ADV_RUNTIME_UNKNOWN_CHARACTER',
          severity: 'error',
          message: `Unknown tachie character: ${name}`,
          source,
        })
        continue
      }
      const status = isRecord(item) && typeof item.status === 'string' ? item.status : 'default'
      if (!statuses.includes(status)) {
        diagnostics.push({
          code: 'ADV_RUNTIME_MISSING_TACHIE_STATUS',
          severity: 'error',
          message: `Missing tachie status: ${name}/${status}`,
          source,
        })
      }
    }
  }
}

function normalizeAction(value: unknown): RuntimeActionCall | undefined {
  if (!isRecord(value) || typeof value.type !== 'string' || !capabilityPattern.test(value.type))
    return undefined
  const explicitArgs = isRecord(value.args) ? value.args : undefined
  const args = explicitArgs ?? Object.fromEntries(
    Object.entries(value).filter(([key, child]) => (
      !['type', 'when', 'condition', 'actions'].includes(key) && child !== undefined
    )),
  )
  const call: RuntimeActionCall = { type: value.type }
  if (Object.keys(args).length)
    call.args = json(args) as JsonObject
  return call
}

function blockLogic(value: unknown): {
  id?: string
  actions: RuntimeActionCall[]
  operations: JsonValue[]
  when?: string
  conditionMarker?: string
  activity?: { type: string, input: JsonObject }
  invalidActionCount: number
  invalidActivity: boolean
} {
  const values = Array.isArray(value) ? value : []
  const first = isRecord(values[0]) ? values[0] : undefined
  const when = typeof first?.when === 'string' ? first.when : undefined
  const conditionMarker = first?.type === 'when' && typeof first.condition === 'string'
    ? first.condition
    : undefined
  const activity = first?.type === 'activity'
    && typeof first.use === 'string'
    && capabilityPattern.test(first.use)
    ? {
        type: first.use,
        input: isRecord(first.input) ? json(first.input) as JsonObject : {},
      }
    : undefined
  const nestedActionValues = Array.isArray(first?.actions) ? first.actions : []
  const nestedActions = nestedActionValues
    .map(normalizeAction)
    .filter((action): action is RuntimeActionCall => Boolean(action))
  const directActionValues = values.filter(value => (
    isRecord(value) && typeof value.type === 'string' && value.type.includes('/')
  ))
  const directActions = values.map(normalizeAction).filter((action): action is RuntimeActionCall => Boolean(action))
  const operations = values.filter((operation) => {
    if (!isRecord(operation))
      return false
    return operation.type !== 'actions'
      && operation.type !== 'when'
      && operation.type !== 'activity'
      && !normalizeAction(operation)
  }).map(json)
  return {
    id: typeof first?.id === 'string' ? first.id : undefined,
    actions: [...nestedActions, ...directActions],
    operations,
    when,
    conditionMarker,
    activity,
    invalidActionCount: nestedActionValues.filter(value => !normalizeAction(value)).length
      + directActionValues.filter(value => !normalizeAction(value)).length,
    invalidActivity: first?.type === 'activity' && !activity,
  }
}

function sourceLocation(
  node: AdvAst.Node,
  sourcePath?: string,
): CompileSourceLocation | undefined {
  if (!sourcePath && !node.position)
    return undefined
  return {
    file: sourcePath,
    line: node.position?.start.line,
    column: node.position?.start.column,
  }
}

function compileNode(
  node: AdvAst.Child,
  id: string,
  diagnostics: CompileDiagnostic[],
  sourcePath?: string,
  resources?: MarkdownResourceCatalog,
): RuntimeNodeInput | null {
  const source = sourceLocation(node, sourcePath)
  const withSource = (compiled: RuntimeNodeInput): RuntimeNodeInput => ({
    ...compiled,
    source,
  })

  switch (node.type) {
    case 'dialog':
      return withSource({
        id,
        kind: 'dialog',
        data: {
          character: node.character.name,
          status: node.character.status ?? '',
          text: phrasingText(node.children),
        },
      })
    case 'narration':
      return withSource({ id, kind: 'narration', data: { text: node.children.join('\n') } })
    case 'text':
      return withSource({ id, kind: 'text', data: { text: node.value } })
    case 'paragraph': {
      const text = phrasingText(node.children)
      return text.trim() ? withSource({ id, kind: 'text', data: { text } }) : null
    }
    case 'scene':
      return withSource({
        id,
        kind: 'scene',
        data: {
          place: node.place,
          time: node.time,
          inOrOut: node.inOrOut,
        },
      })
    case 'heading':
      return withSource({
        id,
        kind: 'anchor',
        data: { depth: node.depth, text: node.value },
      })
    case 'choices': {
      const hasExecutableChoice = node.choices.some(choice => typeof choice.do?.value === 'string')
      if (hasExecutableChoice) {
        const executable = node.choices.find(choice => typeof choice.do?.value === 'string')
        diagnostics.push({
          code: 'ADV_RUNTIME_EXECUTABLE_CHOICE_ACTION',
          severity: 'error',
          message: 'Executable choice actions are not supported by RuntimeProgram',
          source: executable ? sourceLocation(executable, sourcePath) : source,
        })
      }
      return withSource({
        id,
        kind: 'choices',
        choices: node.choices.map((choice, index) => {
          const logic = blockLogic(choice.do?.value)
          if (logic.invalidActionCount > 0) {
            diagnostics.push({
              code: 'ADV_RUNTIME_INVALID_ACTION',
              severity: 'error',
              message: 'Choice actions require a namespaced type such as variables/set or plugin/action',
              source: sourceLocation(choice, sourcePath),
            })
          }
          return {
            id: logic.id ?? `choice-${index + 1}`,
            label: choice.text,
            target: choice.target,
            when: logic.when,
            actions: logic.actions.length ? logic.actions : undefined,
            source: sourceLocation(choice, sourcePath),
          }
        }),
      })
    }
    case 'code': {
      if (typeof node.value === 'string') {
        diagnostics.push({
          code: 'ADV_RUNTIME_EXECUTABLE_SCRIPT',
          severity: 'error',
          message: 'Executable script blocks are not supported by RuntimeProgram',
          source: sourcePath ? { file: sourcePath } : undefined,
        })
        return null
      }
      if (!node.value?.length)
        return null
      const logic = blockLogic(node.value)
      if (logic.invalidActionCount > 0) {
        diagnostics.push({
          code: 'ADV_RUNTIME_INVALID_ACTION',
          severity: 'error',
          message: 'Actions require a namespaced type such as variables/set or plugin/action',
          source,
        })
      }
      if (logic.invalidActivity) {
        diagnostics.push({
          code: 'ADV_RUNTIME_INVALID_ACTIVITY',
          severity: 'error',
          message: 'Activities require a namespaced use value such as plugin/activity',
          source,
        })
      }
      logic.operations.forEach(operation => validateEffectOperation(operation, diagnostics, source, resources))
      if (logic.conditionMarker) {
        return withSource({
          id,
          kind: '$condition',
          data: { condition: logic.conditionMarker },
        })
      }
      if (logic.activity) {
        return withSource({
          id,
          kind: logic.activity.type,
          data: logic.activity.input,
          when: logic.when,
          actions: logic.actions.length ? logic.actions : undefined,
        })
      }
      return withSource({
        id,
        kind: logic.operations.length ? 'effects' : 'actions',
        data: logic.operations.length ? { operations: logic.operations } : undefined,
        when: logic.when,
        actions: logic.actions.length ? logic.actions : undefined,
      })
    }
    default:
      return null
  }
}

export async function compileMarkdownProgram(source: MarkdownProgramSource): Promise<CompileResult<RuntimeProgram>> {
  const diagnostics: CompileDiagnostic[] = []
  const chapters: RuntimeChapterInput[] = []

  for (const chapterSource of source.chapters) {
    const ast = await parseAst(chapterSource.content)
    const nodes: RuntimeNodeInput[] = []
    let pendingCondition: { value: string, source?: CompileSourceLocation } | undefined
    ast.children.forEach((node, index) => {
      const compiled = compileNode(
        node,
        node.id ?? `node-${index}`,
        diagnostics,
        chapterSource.sourcePath,
        source.resources,
      )
      if (!compiled)
        return
      if (compiled.kind === '$condition') {
        const value = compiled.data?.condition
        if (typeof value === 'string')
          pendingCondition = { value, source: compiled.source }
        return
      }
      if (pendingCondition) {
        compiled.when = pendingCondition.value
        compiled.whenSource = pendingCondition.source
        pendingCondition = undefined
      }
      nodes.push(compiled)
    })

    if (pendingCondition) {
      diagnostics.push({
        code: 'ADV_RUNTIME_DANGLING_CONDITION',
        severity: 'error',
        message: 'A when block must be followed by a runtime node',
        source: pendingCondition.source,
      })
    }

    nodes.push({ id: 'end', kind: 'end' })
    nodes.forEach((node, index) => {
      const next = nodes[index + 1]
      if (next)
        node.next = { chapterId: chapterSource.id, nodeId: next.id }
    })

    chapters.push({
      id: chapterSource.id,
      title: chapterSource.title,
      entry: nodes[0].id,
      nodes,
    })
  }

  if (diagnostics.some(item => item.severity === 'error'))
    return { diagnostics }

  const firstChapter = chapters[0]
  if (!firstChapter) {
    return {
      diagnostics: [{
        code: 'ADV_RUNTIME_NO_CHAPTERS',
        severity: 'error',
        message: 'RuntimeProgram requires at least one chapter',
      }],
    }
  }

  const linked = await linkRuntimeProgram({
    id: source.id,
    entry: { chapterId: firstChapter.id, nodeId: firstChapter.entry },
    chapters,
    requiredPlugins: source.requiredPlugins,
  })
  return {
    program: linked.program,
    diagnostics: [...diagnostics, ...linked.diagnostics],
  }
}
