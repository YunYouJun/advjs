import type { RuntimeAddress, RuntimeProgram } from '@advjs/types'
import type { CompileDiagnostic, CompileSourceLocation, MarkdownResourceCatalog } from '../compiler'
import type { AdvRuntimePlugin } from '../runtime/registry'
import { parseAst } from '@advjs/parser'
import { compileMarkdownProgram } from '../compiler'
import { validateRuntimeProgramPlugins } from '../runtime/registry'

const CHAPTER_EXTENSION_RE = /\.adv\.md$/u

/** One Markdown chapter as an authoring host has it open. */
export interface AuthoringChapterSource {
  /** Project-relative path, e.g. `adv/chapters/one.adv.md`. */
  file: string
  /** Display title; defaults to the file name. */
  name?: string
  content?: string
}

/** Unsaved editor buffer compiled in place of (or in addition to) a chapter file. */
export interface AuthoringOverride {
  file: string
  content: string
}

export interface AuthoringProgramRow {
  chapterId: string
  chapterTitle?: string
  nodeId: string
  kind: string
  next?: RuntimeAddress
  source?: CompileSourceLocation
}

export interface AuthoringProgramResult {
  program?: RuntimeProgram
  rows: AuthoringProgramRow[]
  diagnostics: CompileDiagnostic[]
}

export interface CompileAuthoringProgramOptions {
  chapters: readonly AuthoringChapterSource[]
  requiredPlugins?: Record<string, string>
  /** Runtime plugins the host can run; used to validate actions and nodes. */
  plugins?: readonly AdvRuntimePlugin[]
  override?: AuthoringOverride
  resources?: MarkdownResourceCatalog
}

interface ResolvedChapter {
  file: string
  name: string
  content: string
  id: string
}

function chapterBasename(file: string): string {
  return file.split('/').pop()?.replace(CHAPTER_EXTENSION_RE, '') ?? ''
}

/**
 * Stable runtime chapter IDs for chapter files: the file name, made a valid
 * identifier and de-duplicated in file order.
 */
export function createAuthoringChapterIdMap(files: readonly string[]): Map<string, string> {
  const used = new Set<string>()
  const result = new Map<string, string>()

  files.forEach((file, index) => {
    const baseId = chapterBasename(file)
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

function resolveChapters(
  chapters: readonly AuthoringChapterSource[],
  override?: AuthoringOverride,
): ResolvedChapter[] {
  const values = chapters.map(chapter => ({
    file: chapter.file,
    name: chapter.name ?? chapterBasename(chapter.file),
    content: override?.file === chapter.file
      ? override.content
      : chapter.content ?? '',
  }))
  if (override && !values.some(chapter => chapter.file === override.file)) {
    values.push({
      file: override.file,
      name: override.file.split('/').pop()?.replace(CHAPTER_EXTENSION_RE, '') ?? override.file,
      content: override.content,
    })
  }

  const ids = createAuthoringChapterIdMap(values.map(chapter => chapter.file))
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

/**
 * Compile the chapters an author has open into one runtime program, with
 * source-aware rows for structure views and diagnostics that point at files,
 * lines and columns.
 */
export async function compileAuthoringProgram(
  options: CompileAuthoringProgramOptions,
): Promise<AuthoringProgramResult> {
  const sources = resolveChapters(options.chapters, options.override)
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
      requiredPlugins: options.requiredPlugins,
      resources: options.resources,
    })
  }
  catch (error) {
    return {
      rows: [],
      diagnostics: [diagnosticFromError(error, options.override?.file ?? sources[0]?.file ?? '')],
    }
  }

  if (!compiled.program)
    return { rows: [], diagnostics: compiled.diagnostics }

  const pluginDiagnostics: CompileDiagnostic[] = validateRuntimeProgramPlugins(
    compiled.program,
    options.plugins ?? [],
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
