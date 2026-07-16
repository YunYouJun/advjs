import type { RuntimeChapter, RuntimeProgram } from '@advjs/types'
import type { CompileDiagnostic, CompileResult, RuntimeProgramInput } from './types'
import { RUNTIME_SCHEMA_VERSION } from '@advjs/types'
import { hashRuntimeProgram } from './hash'

function error(code: string, message: string): CompileDiagnostic {
  return { code, severity: 'error', message }
}

export async function linkRuntimeProgram(input: RuntimeProgramInput): Promise<CompileResult<RuntimeProgram>> {
  const diagnostics: CompileDiagnostic[] = []
  const chapters = Object.create(null) as Record<string, RuntimeChapter>

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
    for (const node of chapterInput.nodes) {
      if (Object.hasOwn(nodes, node.id)) {
        diagnostics.push(error(
          'ADV_RUNTIME_DUPLICATE_NODE',
          `Duplicate node id in ${chapterInput.id}: ${node.id}`,
        ))
        continue
      }
      nodes[node.id] = node
      order.push(node.id)
    }

    chapters[chapterInput.id] = {
      id: chapterInput.id,
      title: chapterInput.title,
      entry: chapterInput.entry,
      nodes,
      order,
    }
  }

  const hasAddress = (chapterId: string, nodeId: string) => (
    Object.hasOwn(chapters, chapterId) && Object.hasOwn(chapters[chapterId].nodes, nodeId)
  )

  if (!hasAddress(input.entry.chapterId, input.entry.nodeId)) {
    diagnostics.push(error(
      'ADV_RUNTIME_UNKNOWN_ENTRY',
      `Unknown program entry: ${input.entry.chapterId}#${input.entry.nodeId}`,
    ))
  }

  for (const chapter of Object.values(chapters)) {
    if (!Object.hasOwn(chapter.nodes, chapter.entry)) {
      diagnostics.push(error(
        'ADV_RUNTIME_UNKNOWN_CHAPTER_ENTRY',
        `Unknown entry for ${chapter.id}: ${chapter.entry}`,
      ))
    }

    for (const node of Object.values(chapter.nodes)) {
      if (node.next && !hasAddress(node.next.chapterId, node.next.nodeId)) {
        diagnostics.push(error(
          'ADV_RUNTIME_UNKNOWN_TARGET',
          `Unknown target from ${chapter.id}#${node.id}: ${node.next.chapterId}#${node.next.nodeId}`,
        ))
      }
    }
  }

  if (diagnostics.some(item => item.severity === 'error'))
    return { diagnostics }

  const withoutHash: Omit<RuntimeProgram, 'hash'> = {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    id: input.id,
    entry: input.entry,
    chapters,
    requiredPlugins: input.requiredPlugins ?? {},
  }
  const hash = await hashRuntimeProgram(withoutHash)

  return {
    program: { ...withoutHash, hash },
    diagnostics,
  }
}
