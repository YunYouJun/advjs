import type { AdvChapter, AdvProjectChapter, AdvProjectDiagnostic, JsonObject } from '@advjs/types'
import { validateFlowChapter } from '../compiler/flow-validation'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/** Pure, bounded JSON reader shared by file hosts. Unknown author metadata stays in source. */
export function parseProjectFlowChapter(content: string, path: string, diagnostics: AdvProjectDiagnostic[]): AdvChapter | undefined {
  let value: unknown
  try {
    if (content.length > 10 * 1024 * 1024)
      throw new Error('Flow chapter exceeds the 10 MiB authoring limit')
    value = JSON.parse(content)
  }
  catch (error) {
    diagnostics.push({ code: 'ADV_PROJECT_INVALID_JSON', severity: 'error', message: error instanceof Error ? error.message : String(error), path })
    return undefined
  }
  if (!record(value) || value.schemaVersion !== 1) {
    diagnostics.push({ code: 'ADV_PROJECT_FLOW_SCHEMA', severity: 'error', message: 'Serialized Flow chapters require schemaVersion: 1', path })
    return undefined
  }
  const issues: Parameters<typeof validateFlowChapter>[1] = []
  const valid = validateFlowChapter(value, issues, { file: path, line: 1, column: 1 })
  diagnostics.push(...issues.map(issue => ({ code: issue.code, severity: issue.severity, message: issue.message, path, line: 1, column: 1 })))
  return valid ? value as unknown as AdvChapter : undefined
}

export function collectProjectFlowChapters(files: ReadonlyMap<string, string>, root: string, game: JsonObject, gamePath: string | undefined, diagnostics: AdvProjectDiagnostic[]): AdvProjectChapter[] {
  const chapters: AdvProjectChapter[] = []
  const configured = Array.isArray(game.chapters) ? game.chapters : []
  const append = (content: string, path: string, declaredId?: unknown) => {
    const flow = parseProjectFlowChapter(content, path, diagnostics)
    if (!flow)
      return
    if (declaredId !== undefined && declaredId !== flow.id) {
      diagnostics.push({ code: 'ADV_PROJECT_FLOW_CHAPTER_ID_MISMATCH', severity: 'error', message: `Declared chapter ${String(declaredId)} differs from serialized chapter ${flow.id}`, path })
      return
    }
    chapters.push({ id: flow.id, title: flow.title, sources: [path], flow })
  }
  if (configured.length) {
    for (const chapter of configured) {
      if (!record(chapter)) {
        diagnostics.push({ code: 'ADV_PROJECT_FLOW_SCHEMA', severity: 'error', message: 'Configured Flow chapters must be records', path: gamePath })
        continue
      }
      if (Array.isArray(chapter.nodes)) {
        append(JSON.stringify({ schemaVersion: 1, ...chapter }), gamePath ?? `${root}/settings/game.json`)
        continue
      }
      if (!Array.isArray(chapter.sources) || chapter.sources.length !== 1 || typeof chapter.sources[0] !== 'string') {
        diagnostics.push({ code: 'ADV_PROJECT_CHAPTER_WITHOUT_SOURCE', severity: 'error', message: 'Flow chapters require exactly one .chapter.json source', path: gamePath })
        continue
      }
      const reference = chapter.sources[0]
      if (reference.startsWith('/') || reference.includes('\\') || reference.split('/').some(part => !part || part === '.' || part === '..') || !reference.endsWith('.chapter.json')) {
        diagnostics.push({ code: 'ADV_PROJECT_INVALID_PATH', severity: 'error', message: `Invalid Flow source path: ${reference}`, path: gamePath })
        continue
      }
      const path = files.has(`${root}/${reference}`) ? `${root}/${reference}` : reference
      if (!files.has(path)) {
        diagnostics.push({ code: 'ADV_PROJECT_CHAPTER_NOT_FOUND', severity: 'error', message: `Flow source not found: ${path}`, path })
        continue
      }
      append(files.get(path)!, path, chapter.id)
    }
  }
  else {
    for (const path of [...files.keys()].filter(path => path.startsWith(`${root}/chapters/`) && path.endsWith('.chapter.json')).sort())
      append(files.get(path)!, path)
  }
  const ids = new Set<string>()
  for (const chapter of chapters) {
    if (ids.has(chapter.id))
      diagnostics.push({ code: 'ADV_PROJECT_DUPLICATE_CHAPTER', severity: 'error', message: `Duplicate project chapter: ${chapter.id}`, path: chapter.sources[0] })
    ids.add(chapter.id)
  }
  return chapters
}

/** Player projection contains only supported runtime fields, never author prompts. */
export function projectRuntimeFlowChapter(chapter: AdvChapter): AdvChapter {
  const target = (value: AdvChapter['nodes'][number]['next']) => typeof value === 'string' || value === undefined || value === null ? value : { chapterId: value.chapterId, nodeId: value.nodeId }
  const common = (node: AdvChapter['nodes'][number]) => ({ id: node.id, type: node.type, ...(node.next !== undefined ? { next: target(node.next) } : {}) })
  return {
    id: chapter.id,
    title: chapter.title,
    ...(chapter.startNodeId !== undefined ? { startNodeId: chapter.startNodeId } : {}),
    nodes: chapter.nodes.map((node) => {
      const base = common(node)
      switch (node.type) {
        case 'dialogues':
        case undefined:
          if ('dialogues' in node)
            return { ...base, type: 'dialogues', dialogues: node.dialogues.map(dialogue => ({ text: dialogue.text, ...(dialogue.speakerId !== undefined ? { speakerId: dialogue.speakerId } : dialogue.speaker !== undefined ? { speaker: dialogue.speaker } : {}), ...(dialogue.status !== undefined ? { status: dialogue.status } : {}), ...(dialogue.lineId !== undefined ? { lineId: dialogue.lineId } : {}) })) }
          break
        case 'narration': return { ...base, type: node.type, text: node.text, ...(node.lineId !== undefined ? { lineId: node.lineId } : {}) }
        case 'choices': return { ...base, type: node.type, choices: node.choices.map(choice => ({ id: choice.id, text: choice.text, target: target(choice.target)!, ...(choice.when !== undefined ? { when: choice.when } : {}) })) }
        case 'audio': return { ...base, type: node.type, operations: node.operations }
        case 'background': return { ...base, type: node.type, name: node.name, ...(node.src !== undefined ? { src: node.src } : {}) }
        case 'tachie': return { ...base, type: node.type, name: node.name, action: node.action, ...(node.status !== undefined ? { status: node.status } : {}), ...(node.enter !== undefined ? { enter: node.enter } : {}), ...(node.exit !== undefined ? { exit: node.exit } : {}) }
        case 'start': return { ...base, type: node.type }
        case 'end': return { id: node.id, type: node.type }
        case 'fountain': return { ...base, type: node.type, src: node.src }
      }
      throw new Error('ADV_PROJECT_INVALID_FLOW_NODE')
    }),
  }
}
