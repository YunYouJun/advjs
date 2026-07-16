import type {
  AdvChapter,
  AdvDialoguesNode,
  AdvFlowNode,
  JsonValue,
  RuntimeProgram,
} from '@advjs/types'
import type {
  CompileDiagnostic,
  CompileResult,
  RuntimeChapterInput,
  RuntimeNodeInput,
  RuntimeTargetInput,
} from './types'
import { linkRuntimeProgram } from './link'

export interface FlowProgramSource {
  id: string
  chapters: AdvChapter[]
  requiredPlugins?: Record<string, string>
}

function flowTarget(
  target: AdvFlowNode['next'],
  chapterId: string,
): RuntimeTargetInput | undefined {
  if (typeof target === 'string')
    return { chapterId, nodeId: target }
  return target ? structuredClone(target) : undefined
}

function defaultNext(
  chapter: AdvChapter,
  index: number,
): RuntimeTargetInput | undefined {
  const next = chapter.nodes[index + 1]
  return next ? { chapterId: chapter.id, nodeId: next.id } : undefined
}

function compileDialogues(
  chapter: AdvChapter,
  node: AdvDialoguesNode,
  index: number,
): RuntimeNodeInput[] {
  if (!node.dialogues.length) {
    return [{
      id: node.id,
      kind: 'anchor',
      next: flowTarget(node.next, chapter.id) ?? defaultNext(chapter, index),
    }]
  }

  return node.dialogues.map((dialogue, dialogIndex) => {
    const id = dialogIndex === 0 ? node.id : `${node.id}.dialog-${dialogIndex + 1}`
    const nextId = dialogIndex + 1 < node.dialogues.length
      ? `${node.id}.dialog-${dialogIndex + 2}`
      : undefined
    return {
      id,
      kind: 'dialog',
      data: {
        character: dialogue.speakerId ?? dialogue.speaker ?? '',
        text: dialogue.text,
      },
      next: nextId
        ? { chapterId: chapter.id, nodeId: nextId }
        : (flowTarget(node.next, chapter.id) ?? defaultNext(chapter, index)),
    }
  })
}

function compileFlowNode(
  chapter: AdvChapter,
  node: AdvFlowNode,
  index: number,
  diagnostics: CompileDiagnostic[],
): RuntimeNodeInput[] {
  const next = flowTarget(node.next, chapter.id) ?? defaultNext(chapter, index)
  switch (node.type) {
    case 'start':
      return [{ id: node.id, kind: 'anchor', next }]
    case 'background':
      return [{
        id: node.id,
        kind: 'effects',
        data: {
          operations: [{ type: 'background', name: node.name, url: node.src }] as JsonValue,
        },
        next,
      }]
    case 'tachie': {
      const operation: JsonValue = node.action === 'exit'
        ? { type: 'tachie', exit: node.exit ?? [node.name] }
        : {
            type: 'tachie',
            enter: node.enter ?? [{ name: node.name, status: node.status }],
          }
      return [{
        id: node.id,
        kind: 'effects',
        data: { operations: [operation] },
        next,
      }]
    }
    case 'dialogues':
    case undefined:
      if ('dialogues' in node)
        return compileDialogues(chapter, node, index)
      break
    case 'end':
      return [{ id: node.id, kind: 'end' }]
    case 'fountain':
      diagnostics.push({
        code: 'ADV_RUNTIME_FLOW_FOUNTAIN_REQUIRES_SOURCE',
        severity: 'error',
        message: `Fountain node ${chapter.id}#${node.id} must be compiled from its Markdown source`,
      })
      return []
  }

  const unknownNode = node as unknown as { id: string, type?: string }
  diagnostics.push({
    code: 'ADV_RUNTIME_UNKNOWN_FLOW_NODE',
    severity: 'error',
    message: `Unknown Flow node kind in ${chapter.id}#${unknownNode.id}: ${String(unknownNode.type)}`,
  })
  return []
}

export async function compileFlowProgram(source: FlowProgramSource): Promise<CompileResult<RuntimeProgram>> {
  const diagnostics: CompileDiagnostic[] = []
  const chapters: RuntimeChapterInput[] = source.chapters.map((chapter) => {
    const nodes = chapter.nodes.flatMap((node, index) => (
      compileFlowNode(chapter, node, index, diagnostics)
    ))
    if (!nodes.length) {
      diagnostics.push({
        code: 'ADV_RUNTIME_EMPTY_CHAPTER',
        severity: 'error',
        message: `Flow chapter has no runtime nodes: ${chapter.id}`,
      })
      nodes.push({ id: '$end', kind: 'end' })
    }
    return {
      id: chapter.id,
      title: chapter.title,
      entry: chapter.startNodeId ?? nodes[0].id,
      nodes,
    }
  })

  const firstChapter = chapters[0]
  if (!firstChapter) {
    return {
      diagnostics: [{
        code: 'ADV_RUNTIME_NO_CHAPTERS',
        severity: 'error',
        message: 'RuntimeProgram requires at least one Flow chapter',
      }],
    }
  }

  const linked = await linkRuntimeProgram({
    id: source.id,
    entry: { chapterId: firstChapter.id, nodeId: firstChapter.entry },
    chapters,
    requiredPlugins: source.requiredPlugins,
  })
  const allDiagnostics = [...diagnostics, ...linked.diagnostics]
  return {
    program: allDiagnostics.some(item => item.severity === 'error') ? undefined : linked.program,
    diagnostics: allDiagnostics,
  }
}
