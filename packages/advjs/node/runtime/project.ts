import type { CompileResult } from '@advjs/core'
import type { AdvChapter, JsonObject, RuntimeProgram } from '@advjs/types'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { compileProject, createLegacyChapterProject, groupLegacyChapterFiles, isRuntimeIdentifier } from '@advjs/core'

export interface RuntimeChapterFiles {
  id: string
  title?: string
  paths: string[]
}

export interface CompileRuntimeChapterFilesOptions {
  id: string
  chapters: RuntimeChapterFiles[]
  entryChapterId?: string
  requiredPlugins?: Record<string, string>
  staticAnalysis?: boolean
  variables?: JsonObject
  /** Local author material; only referenced footnotes reach the program. */
  glossaryPath?: string
}

export interface ResolveConfiguredRuntimeChapterFilesOptions {
  cwd: string
  scriptPath: string
  chapters: AdvChapter[]
}

async function scanChapterFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      return scanChapterFiles(path)
    return entry.name.endsWith('.adv.md') ? [path] : []
  }))
  return files.flat().sort()
}

function findChaptersDirectory(scriptPath: string): string | undefined {
  let current = dirname(scriptPath)
  while (true) {
    if (basename(current) === 'chapters')
      return current
    const parent = dirname(current)
    if (parent === current)
      return undefined
    current = parent
  }
}

function singleChapterId(scriptPath: string): string {
  const stem = basename(scriptPath, '.adv.md')
  return isRuntimeIdentifier(stem) ? stem : 'chapter-1'
}

export async function discoverRuntimeChapterFiles(scriptPath: string): Promise<RuntimeChapterFiles[]> {
  const chaptersDirectory = findChaptersDirectory(scriptPath)
  if (!chaptersDirectory) {
    const id = singleChapterId(scriptPath)
    return [{ id, title: id, paths: [scriptPath] }]
  }

  const files = await scanChapterFiles(chaptersDirectory)
  const absolute = new Map(files.map(file => [relative(chaptersDirectory, file).split(sep).join('/'), file]))
  return groupLegacyChapterFiles([...absolute.keys()]).map(group => ({
    id: group.id,
    title: group.title,
    paths: group.paths.map(path => absolute.get(path)!),
  }))
}

export function resolveConfiguredRuntimeChapterFiles(
  options: ResolveConfiguredRuntimeChapterFilesOptions,
): { chapters: RuntimeChapterFiles[], entryChapterId?: string } {
  const requested = resolve(options.scriptPath)
  let entryChapterId: string | undefined
  const chapters = options.chapters.flatMap((chapter) => {
    const paths = chapter.nodes
      .filter(node => node.type === 'fountain')
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .map((node) => {
        const candidates = node.src.startsWith('/')
          ? [
              resolve(options.cwd, 'public', `.${node.src}`),
              resolve(options.cwd, `.${node.src}`),
            ]
          : [
              resolve(options.cwd, node.src),
              resolve(options.cwd, 'public', node.src),
            ]
        return candidates.find(existsSync) ?? candidates[0]
      })

    if (paths.some(path => resolve(path) === requested))
      entryChapterId = chapter.id
    return paths.length
      ? [{ id: chapter.id, title: chapter.title, paths }]
      : []
  })

  return { chapters, entryChapterId }
}

export async function compileRuntimeChapterFiles(
  options: CompileRuntimeChapterFilesOptions,
): Promise<CompileResult<RuntimeProgram>> {
  const originalPaths = new Map<string, string>()
  let glossary: string | undefined
  if (options.glossaryPath) {
    try {
      glossary = await readFile(options.glossaryPath, 'utf8')
      originalPaths.set('adv/glossary.md', options.glossaryPath)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error
    }
  }
  const { files, sourcePaths } = createLegacyChapterProject({
    chapters: await Promise.all(options.chapters.map(async chapter => ({
      id: chapter.id,
      title: chapter.title,
      sources: await Promise.all(chapter.paths.map(path => readFile(path, 'utf8'))),
    }))),
    entryChapterId: options.entryChapterId,
    requiredPlugins: options.requiredPlugins,
    variables: options.variables,
    glossary,
  })
  options.chapters.forEach((chapter, index) => {
    chapter.paths.forEach((path, sourceIndex) => originalPaths.set(sourcePaths[index][sourceIndex], path))
  })

  const result = await compileProject(
    { id: options.id, files },
    { validateContentReferences: false, staticAnalysis: options.staticAnalysis },
  )
  return {
    program: result.project.program,
    diagnostics: result.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      suggestion: diagnostic.suggestion,
      certainty: diagnostic.certainty,
      source: {
        file: diagnostic.path ? (originalPaths.get(diagnostic.path) ?? diagnostic.path) : undefined,
        line: diagnostic.line,
        column: diagnostic.column,
      },
    })),
  }
}
