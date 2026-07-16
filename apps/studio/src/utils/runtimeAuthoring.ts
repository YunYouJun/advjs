import type {
  CompileDiagnostic,
  CompileSourceLocation,
} from '@advjs/core'
import type { RuntimeAddress, RuntimeProgram } from '@advjs/types'
import type { ChapterInfo } from '../composables/useProjectContent'
import type { StudioGameSettings } from './projectRuntimeFiles'
import { compileMarkdownProgram, validateRuntimeProgramPlugins } from '@advjs/core'
import { parseAst } from '@advjs/parser'
import { createStudioRuntimePlugins } from './studioRuntimePlugins'

export interface RuntimeAuthoringOverride {
  file: string
  content: string
}

export interface RuntimeProgramRow {
  chapterId: string
  chapterTitle?: string
  nodeId: string
  kind: string
  next?: RuntimeAddress
  source?: CompileSourceLocation
}

export interface RuntimeAuthoringResult {
  program?: RuntimeProgram
  rows: RuntimeProgramRow[]
  diagnostics: CompileDiagnostic[]
}

interface AuthoringChapter extends ChapterInfo {
  content: string
  id: string
}

export function createStudioChapterIdMap(files: readonly string[]): Map<string, string> {
  const used = new Set<string>()
  const result = new Map<string, string>()

  files.forEach((file, index) => {
    const basename = file.split('/').pop()?.replace(/\.adv\.md$/, '') ?? ''
    const baseId = basename
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `chapter-${index + 1}`
    let id = /^\w/.test(baseId) && !baseId.startsWith('_')
      ? baseId
      : `chapter-${baseId}`
    const uniqueBaseId = id
    let suffix = 2
    while (used.has(id))
      id = `${uniqueBaseId}-${suffix++}`
    used.add(id)
    result.set(file, id)
  })

  return result
}

function authoringChapters(
  chapters: readonly ChapterInfo[],
  override?: RuntimeAuthoringOverride,
): AuthoringChapter[] {
  const values = chapters.map(chapter => ({
    ...chapter,
    content: override?.file === chapter.file
      ? override.content
      : chapter.content ?? '',
  }))
  if (override && !values.some(chapter => chapter.file === override.file)) {
    values.push({
      file: override.file,
      name: override.file.split('/').pop()?.replace(/\.adv\.md$/, '') ?? override.file,
      preview: '',
      content: override.content,
    })
  }

  const ids = createStudioChapterIdMap(values.map(chapter => chapter.file))
  return values.map(chapter => ({
    ...chapter,
    id: ids.get(chapter.file)!,
  }))
}

function diagnosticFromError(error: unknown, file: string): CompileDiagnostic {
  return {
    code: 'ADV_STUDIO_RUNTIME_PARSE_FAILED',
    severity: 'error',
    message: error instanceof Error ? error.message : String(error),
    source: { file },
  }
}

export async function compileRuntimeAuthoringProject(
  chapters: readonly ChapterInfo[],
  settings: StudioGameSettings,
  override?: RuntimeAuthoringOverride,
): Promise<RuntimeAuthoringResult> {
  const sources = authoringChapters(chapters, override)
  const sourceByAddress = new Map<string, CompileSourceLocation>()
  const parseDiagnostics: CompileDiagnostic[] = []

  for (const chapter of sources) {
    try {
      const ast = await parseAst(chapter.content)
      ast.children.forEach((node, index) => {
        const nodeId = node.id ?? `node-${index}`
        sourceByAddress.set(`${chapter.id}#${nodeId}`, {
          file: chapter.file,
          line: node.position?.start.line,
          column: node.position?.start.column,
        })
      })
    }
    catch (error) {
      parseDiagnostics.push(diagnosticFromError(error, chapter.file))
    }
  }

  if (parseDiagnostics.length > 0)
    return { rows: [], diagnostics: parseDiagnostics }

  let compiled
  try {
    compiled = await compileMarkdownProgram({
      id: 'adv-studio:authoring',
      chapters: sources.map(chapter => ({
        id: chapter.id,
        title: chapter.name,
        content: chapter.content,
        sourcePath: chapter.file,
      })),
      requiredPlugins: settings.requiredPlugins,
    })
  }
  catch (error) {
    return {
      rows: [],
      diagnostics: [diagnosticFromError(error, override?.file ?? sources[0]?.file ?? '')],
    }
  }

  if (!compiled.program)
    return { rows: [], diagnostics: compiled.diagnostics }

  const pluginDiagnostics: CompileDiagnostic[] = validateRuntimeProgramPlugins(
    compiled.program,
    createStudioRuntimePlugins(),
  ).map(diagnostic => ({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    source: diagnostic.address
      ? sourceByAddress.get(`${diagnostic.address.chapterId}#${diagnostic.address.nodeId}`)
      : undefined,
  }))

  const rows = Object.values(compiled.program.chapters).flatMap(chapter => (
    chapter.order.map(nodeId => ({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      nodeId,
      kind: chapter.nodes[nodeId].kind,
      next: chapter.nodes[nodeId].next,
      source: sourceByAddress.get(`${chapter.id}#${nodeId}`)
        ?? { file: sources.find(source => source.id === chapter.id)?.file },
    }))
  ))

  return {
    program: compiled.program,
    rows,
    diagnostics: [...compiled.diagnostics, ...pluginDiagnostics],
  }
}
