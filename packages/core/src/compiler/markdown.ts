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
