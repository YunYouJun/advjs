import type {
  JsonObject,
  JsonValue,
  RuntimeAddress,
  RuntimeChapter,
  RuntimeChoice,
  RuntimeProgram,
} from '@advjs/types'
import type {
  CompileDiagnostic,
  CompileSourceLocation,
  RuntimeChoiceInput,
  RuntimeNodeInput,
  RuntimeProgramInput,
  RuntimeTargetInput,
} from './types'
import { RUNTIME_SCHEMA_VERSION } from '@advjs/types'
import { isRuntimeIdentifier, parseRuntimeTarget } from './address'
import { hashRuntimeProgram } from './hash'

function error(code: string, message: string, source?: CompileSourceLocation): CompileDiagnostic {
  return { code, severity: 'error', message, source }
}

function isAddress(value: unknown): value is RuntimeAddress {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof (value as RuntimeAddress).chapterId === 'string'
    && typeof (value as RuntimeAddress).nodeId === 'string',
  )
}

function choicesFromData(data: JsonObject | undefined): RuntimeChoiceInput[] | undefined {
  if (!Array.isArray(data?.options))
    return undefined

  return data.options.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return { id: '', label: '' }
    return {
      id: typeof value.id === 'string' ? value.id : '',
      label: typeof value.label === 'string' ? value.label : '',
      target: typeof value.target === 'string' || isAddress(value.target)
        ? value.target
        : undefined,
    }
  })
}

export async function linkRuntimeProgram(input: RuntimeProgramInput): Promise<{
  program?: RuntimeProgram
  diagnostics: CompileDiagnostic[]
}> {
  const diagnostics: CompileDiagnostic[] = []
  const chapters = Object.create(null) as Record<string, RuntimeChapter>
  const chapterInputs = new Map<string, RuntimeProgramInput['chapters'][number]>()
  const nodeInputs = new Map<string, Map<string, RuntimeNodeInput>>()

  for (const chapterInput of input.chapters) {
    if (Object.hasOwn(chapters, chapterInput.id)) {
      diagnostics.push(error(
        'ADV_RUNTIME_DUPLICATE_CHAPTER',
        `Duplicate chapter id: ${chapterInput.id}`,
      ))
      continue
    }

    const nodes = Object.create(null) as RuntimeChapter['nodes']
    const order: string[] = []
    const inputs = new Map<string, RuntimeNodeInput>()
    for (const node of chapterInput.nodes) {
      if (Object.hasOwn(nodes, node.id)) {
        diagnostics.push(error(
          'ADV_RUNTIME_DUPLICATE_NODE',
          `Duplicate node id in ${chapterInput.id}: ${node.id}`,
          node.source,
        ))
        continue
      }

      nodes[node.id] = {
        id: node.id,
        kind: node.kind,
        data: node.data ? structuredClone(node.data) : undefined,
      }
      inputs.set(node.id, node)
      order.push(node.id)
    }

    chapters[chapterInput.id] = {
      id: chapterInput.id,
      title: chapterInput.title,
      entry: chapterInput.entry,
      nodes,
      order,
    }
    chapterInputs.set(chapterInput.id, chapterInput)
    nodeInputs.set(chapterInput.id, inputs)
  }

  const hasAddress = (chapterId: string, nodeId: string) => (
    Object.hasOwn(chapters, chapterId) && Object.hasOwn(chapters[chapterId].nodes, nodeId)
  )

  const resolveTarget = (
    target: RuntimeTargetInput,
    currentChapterId: string,
    context: string,
    source?: CompileSourceLocation,
  ): RuntimeAddress | undefined => {
    let reference: { chapterId: string, nodeId?: string }
    if (typeof target === 'string') {
      const parsed = parseRuntimeTarget(target, currentChapterId)
      if (!parsed.ok) {
        diagnostics.push(error('ADV_RUNTIME_INVALID_TARGET', parsed.message, source))
        return undefined
      }
      reference = parsed.target
    }
    else {
      if (!isRuntimeIdentifier(target.chapterId) || !isRuntimeIdentifier(target.nodeId)) {
        diagnostics.push(error(
          'ADV_RUNTIME_INVALID_TARGET',
          `Invalid runtime address from ${context}: ${target.chapterId}#${target.nodeId}`,
          source,
        ))
        return undefined
      }
      reference = target
    }

    const chapter = chapters[reference.chapterId]
    const nodeId = reference.nodeId ?? chapter?.entry
    if (!chapter || !nodeId || !hasAddress(reference.chapterId, nodeId)) {
      const display = reference.nodeId
        ? `${reference.chapterId}#${reference.nodeId}`
        : reference.chapterId
      diagnostics.push(error(
        'ADV_RUNTIME_UNKNOWN_TARGET',
        `Unknown target from ${context}: ${display}`,
        source,
      ))
      return undefined
    }

    return { chapterId: reference.chapterId, nodeId }
  }

  if (!hasAddress(input.entry.chapterId, input.entry.nodeId)) {
    diagnostics.push(error(
      'ADV_RUNTIME_UNKNOWN_ENTRY',
      `Unknown program entry: ${input.entry.chapterId}#${input.entry.nodeId}`,
    ))
  }

  for (const chapterId of chapterInputs.keys()) {
    const chapter = chapters[chapterId]
    if (!Object.hasOwn(chapter.nodes, chapter.entry)) {
      diagnostics.push(error(
        'ADV_RUNTIME_UNKNOWN_CHAPTER_ENTRY',
        `Unknown entry for ${chapter.id}: ${chapter.entry}`,
      ))
    }

    for (const [nodeId, nodeInput] of nodeInputs.get(chapterId) ?? []) {
      const node = chapter.nodes[nodeId]
      if (nodeInput.next) {
        node.next = resolveTarget(
          nodeInput.next,
          chapterId,
          `${chapterId}#${nodeId}`,
          nodeInput.source,
        )
      }

      const choiceInputs = nodeInput.choices ?? choicesFromData(nodeInput.data)
      if (choiceInputs) {
        const options: RuntimeChoice[] = choiceInputs.map((choice) => {
          if (!choice.id || !choice.label) {
            diagnostics.push(error(
              'ADV_RUNTIME_INVALID_CHOICE',
              `Choice in ${chapterId}#${nodeId} requires non-empty id and label`,
              choice.source ?? nodeInput.source,
            ))
          }
          const resolved = choice.target
            ? resolveTarget(
                choice.target,
                chapterId,
                `${chapterId}#${nodeId} choice ${choice.id}`,
                choice.source ?? nodeInput.source,
              )
            : undefined
          return {
            id: choice.id,
            label: choice.label,
            ...(resolved ? { target: resolved } : {}),
          }
        })
        const data = structuredClone(node.data ?? {})
        data.options = options as unknown as JsonValue
        node.data = data
      }
    }
  }

  if (diagnostics.some(item => item.severity === 'error'))
    return { diagnostics }

  const withoutHash: Omit<RuntimeProgram, 'hash'> = {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    id: input.id,
    entry: structuredClone(input.entry),
    chapters,
    requiredPlugins: structuredClone(input.requiredPlugins ?? {}),
  }
  const hash = await hashRuntimeProgram(withoutHash)

  return {
    program: { ...withoutHash, hash },
    diagnostics,
  }
}
