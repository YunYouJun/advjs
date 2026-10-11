import type {
  AdvChapter,
  AdvDialoguesNode,
  AdvFlowNode,
  JsonValue,
  RuntimeProgram,
} from '@advjs/types'
import type { MarkdownResourceCatalog } from './markdown'
import type {
  CompileDiagnostic,
  CompileResult,
  RuntimeChapterInput,
  RuntimeNodeInput,
  RuntimeTargetInput,
} from './types'
import { validateFlowChapter } from './flow-validation'
import { linkRuntimeProgram } from './link'
import { validateEffectOperation } from './markdown'

export interface FlowProgramSource {
  id: string
  chapters: AdvChapter[]
  requiredPlugins?: Record<string, string>
  resources?: MarkdownResourceCatalog
  sourcePaths?: Record<string, string>
  staticAnalysis?: { variables?: import('@advjs/types').JsonObject }
}

function flowTarget(
  target: AdvFlowNode['next'],
  chapterId: string,
): RuntimeTargetInput | undefined {
  if (typeof target === 'string')
    return target.includes('#') ? target : { chapterId, nodeId: target }
  return target ? structuredClone(target) : undefined
}

function defaultNext(
  chapter: AdvChapter,
  index: number,
): RuntimeTargetInput | undefined {
  const next = chapter.nodes[index + 1]
  return next ? { chapterId: chapter.id, nodeId: next.id } : undefined
}

/** Explicit disconnect must never fall through to the next array item. */
function resolvedNext(chapter: AdvChapter, node: AdvFlowNode, index: number) {
  return node.next === null ? undefined : flowTarget(node.next, chapter.id) ?? defaultNext(chapter, index)
}

function compileDialogues(
  chapter: AdvChapter,
  node: AdvDialoguesNode,
  index: number,
  resources?: MarkdownResourceCatalog,
): RuntimeNodeInput[] {
  if (!node.dialogues.length) {
    return [{
      id: node.id,
      kind: 'anchor',
      next: resolvedNext(chapter, node, index),
    }]
  }

  return node.dialogues.map((dialogue, dialogIndex) => {
    const id = dialogIndex === 0 ? node.id : `${node.id}.dialog-${dialogIndex + 1}`
    const nextId = dialogIndex + 1 < node.dialogues.length
      ? `${node.id}.dialog-${dialogIndex + 2}`
      : undefined
    const declaredSpeaker = dialogue.speakerId || dialogue.speaker || 'narrator'
    const speakerId = resources?.speakers?.[declaredSpeaker] ?? declaredSpeaker
    return {
      id,
      kind: speakerId === 'narrator' ? 'narration' : 'dialog',
      data: {
        character: speakerId === 'narrator' ? '' : speakerId,
        speakerId,
        ...(dialogue.status ? { status: dialogue.status } : {}),
        ...(dialogue.lineId !== undefined ? { lineId: dialogue.lineId } : {}),
        text: dialogue.text,
      },
      next: nextId
        ? { chapterId: chapter.id, nodeId: nextId }
        : (resolvedNext(chapter, node, index)),
    }
  })
}

function compileFlowNode(
  chapter: AdvChapter,
  node: AdvFlowNode,
  index: number,
  diagnostics: CompileDiagnostic[],
  resources?: MarkdownResourceCatalog,
): RuntimeNodeInput[] {
  const next = resolvedNext(chapter, node, index)
  if ('bgmSrc' in node || 'bgmThemeId' in node) {
    diagnostics.push({
      code: 'ADV_AUDIO_LEGACY_OPERATION',
      severity: 'error',
      message: `Flow node ${chapter.id}#${node.id} requires an explicit audio node with native asset IDs`,
    })
  }
  switch (node.type) {
    case 'start':
      return [{ id: node.id, kind: 'anchor', next }]
    case 'audio':
      return [{ id: node.id, kind: 'effects', data: { operations: JSON.parse(JSON.stringify(node.operations)) as JsonValue }, next }]
    case 'background':
      return [{
        id: node.id,
        kind: 'effects',
        data: {
          operations: [{ type: 'background', name: node.name, ...(node.src !== undefined ? { url: node.src } : {}) }] as JsonValue,
        },
        next,
      }]
    case 'tachie': {
      const operation: JsonValue = node.action === 'exit'
        ? { type: 'tachie', exit: typeof node.exit === 'string' ? [node.exit] : node.exit ?? [node.name] }
        : {
            type: 'tachie',
            enter: node.enter ?? [{ name: node.name, status: node.status ?? 'default' }],
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
        return compileDialogues(chapter, node, index, resources)
      break
    case 'narration':
      return [{ id: node.id, kind: 'narration', data: { text: node.text, speakerId: 'narrator', ...(node.lineId !== undefined ? { lineId: node.lineId } : {}) }, next }]
    case 'choices':
      return [{ id: node.id, kind: 'choices', next, choices: node.choices.map(choice => ({ id: choice.id, label: choice.text, target: flowTarget(choice.target, chapter.id), when: choice.when })) }]
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
  const chapters: RuntimeChapterInput[] = source.chapters.filter(chapter => validateFlowChapter(chapter, diagnostics, { file: source.sourcePaths?.[chapter?.id] })).map((chapter) => {
    const location = source.sourcePaths?.[chapter.id] ? { file: source.sourcePaths[chapter.id], line: 1, column: 1 } : undefined
    const nodes = chapter.nodes.flatMap((node, index) => {
      const before = diagnostics.length
      const compiledNodes = compileFlowNode(chapter, node, index, diagnostics, source.resources)
      diagnostics.slice(before).forEach((issue) => {
        issue.source ??= location
      })
      if ('sceneId' in node && node.sceneId && source.resources?.backgrounds && !source.resources.backgrounds.includes(node.sceneId))
        diagnostics.push({ code: 'ADV_RUNTIME_UNKNOWN_BACKGROUND', severity: 'error', message: `Unknown Flow scene: ${node.sceneId}`, source: location })
      if (node.type === 'tachie' && source.resources?.speakers && !Object.hasOwn(source.resources.speakers, node.name))
        diagnostics.push({ code: 'ADV_RUNTIME_UNKNOWN_CHARACTER', severity: 'error', message: `Unknown Flow character: ${node.name}`, source: location })
      return compiledNodes.map((compiled) => {
        compiled.source = location
        if (compiled.kind === 'effects' && Array.isArray(compiled.data?.operations))
          compiled.data.operations.forEach(operation => validateEffectOperation(operation, diagnostics, location, source.resources))
        if (compiled.kind === 'dialog' && source.resources?.speakers && !Object.hasOwn(source.resources.speakers, String(compiled.data?.speakerId)))
          diagnostics.push({ code: 'ADV_RUNTIME_UNKNOWN_CHARACTER', severity: 'error', message: `Unknown Flow speaker: ${String(compiled.data?.speakerId)}`, source: location })
        return compiled
      })
    })
    if (!nodes.length) {
      diagnostics.push({
        code: 'ADV_RUNTIME_EMPTY_CHAPTER',
        severity: 'error',
        message: `Flow chapter has no runtime nodes: ${chapter.id}`,
        source: location,
      })
      nodes.push({ id: '$end', kind: 'end' })
    }
    return {
      id: chapter.id,
      source: location,
      title: chapter.title,
      entry: chapter.startNodeId ?? nodes[0].id,
      nodes,
    }
  })

  const firstChapter = chapters[0]
  if (!firstChapter) {
    return {
      diagnostics: [...diagnostics, {
        code: 'ADV_RUNTIME_NO_CHAPTERS',
        severity: 'error',
        message: 'RuntimeProgram requires at least one Flow chapter',
      }],
    }
  }

  const linked = await linkRuntimeProgram({
    id: source.id,
    source: firstChapter.source,
    entry: { chapterId: firstChapter.id, nodeId: firstChapter.entry },
    chapters,
    requiredPlugins: source.requiredPlugins,
    staticAnalysis: source.staticAnalysis,
  })
  const allDiagnostics = [...diagnostics, ...linked.diagnostics]
  return {
    program: allDiagnostics.some(item => item.severity === 'error') ? undefined : linked.program,
    diagnostics: allDiagnostics,
  }
}
