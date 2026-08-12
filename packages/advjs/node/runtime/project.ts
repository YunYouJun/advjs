import type { CompileResult } from '@advjs/core'
import type { AdvChapter, RuntimeProgram } from '@advjs/types'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { compileProject, isRuntimeIdentifier } from '@advjs/core'

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
  const groups = new Map<string, string[]>()
  for (const file of files) {
    const parts = relative(chaptersDirectory, file).split(sep)
    const raw = parts.length > 1 ? parts[0] : basename(file, '.adv.md')
    const id = /^\d+$/.test(raw)
      ? `chapter-${raw}`
      : (isRuntimeIdentifier(raw) ? raw : `chapter-${groups.size + 1}`)
    const paths = groups.get(id) ?? []
    paths.push(file)
    groups.set(id, paths)
  }

  return Array.from(groups, ([id, paths]) => ({
    id,
    title: id,
    paths: paths.sort(),
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
  const files: Record<string, string> = {
    'adv.config.json': JSON.stringify({ format: 'adv-md', root: './adv' }),
  }
  const originalPaths = new Map<string, string>()
  const chapters = await Promise.all(options.chapters.map(async chapter => ({
    id: chapter.id,
    title: chapter.title,
    sources: await Promise.all(chapter.paths.map(async (path, index) => {
      const projectPath = `adv/chapters/${chapter.id}/${index + 1}.adv.md`
      files[projectPath] = await readFile(path, 'utf8')
      originalPaths.set(projectPath, path)
      return `chapters/${chapter.id}/${index + 1}.adv.md`
    })),
  })))
  files['adv/settings/game.json'] = JSON.stringify({
    entryChapterId: options.entryChapterId,
    requiredPlugins: options.requiredPlugins,
    chapters,
  })

  const result = await compileProject(
    { id: options.id, files },
    { validateContentReferences: false },
  )
  return {
    program: result.project.program,
    diagnostics: result.diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      source: {
        file: diagnostic.path ? (originalPaths.get(diagnostic.path) ?? diagnostic.path) : undefined,
        line: diagnostic.line,
        column: diagnostic.column,
      },
    })),
  }
}
