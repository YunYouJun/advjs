/**
 * Projects that keep scripts in a bare `chapters/` directory (such as the
 * legacy `public/md/chapters/**` layout) are compiled by mapping them onto a
 * canonical `adv/` project. The CLI and native hosts share this mapping.
 */

import type { AdvProjectFileMap, JsonObject } from '@advjs/types'
import { isRuntimeIdentifier } from '../compiler'

export interface LegacyChapterGroup {
  id: string
  title: string
  /** Paths as given, sorted; one runtime chapter may span several files. */
  paths: string[]
}

const DIGITS_RE = /^\d+$/u
const CHAPTER_EXTENSION_RE = /\.adv\.md$/u

/**
 * Group `.adv.md` paths relative to a `chapters/` directory into runtime
 * chapters: a first-level folder is one chapter, a top-level file is its own
 * chapter. Numeric names become `chapter-N`; other invalid identifiers fall
 * back to their position.
 */
export function groupLegacyChapterFiles(relativePaths: readonly string[]): LegacyChapterGroup[] {
  const groups = new Map<string, string[]>()
  for (const path of [...relativePaths].filter(path => path.endsWith('.adv.md')).sort()) {
    const parts = path.split('/')
    const raw = parts.length > 1 ? parts[0] : parts[0].replace(CHAPTER_EXTENSION_RE, '')
    const id = DIGITS_RE.test(raw)
      ? `chapter-${raw}`
      : (isRuntimeIdentifier(raw) ? raw : `chapter-${groups.size + 1}`)
    const paths = groups.get(id) ?? []
    paths.push(path)
    groups.set(id, paths)
  }
  return Array.from(groups, ([id, paths]) => ({ id, title: id, paths: paths.sort() }))
}

export interface LegacyChapterProjectChapter {
  id: string
  title?: string
  /** Script text of each source file, in play order. */
  sources: readonly string[]
}

export interface LegacyChapterProjectInput {
  chapters: readonly LegacyChapterProjectChapter[]
  entryChapterId?: string
  requiredPlugins?: Record<string, string>
  variables?: JsonObject
  /** Author glossary; only referenced footnotes reach the program. */
  glossary?: string
}

export interface LegacyChapterProject {
  files: AdvProjectFileMap
  /** Project path of every source, parallel to `chapters[].sources`. */
  sourcePaths: string[][]
}

/**
 * Canonical project files for legacy chapters. Compile the result with
 * `validateContentReferences: false`: these projects carry no character catalog.
 */
export function createLegacyChapterProject(input: LegacyChapterProjectInput): LegacyChapterProject {
  const files: AdvProjectFileMap = {
    'adv.config.json': JSON.stringify({ format: 'adv-md', root: './adv' }),
  }
  if (input.glossary !== undefined)
    files['adv/glossary.md'] = input.glossary

  const sourcePaths: string[][] = []
  const chapters = input.chapters.map((chapter) => {
    const paths: string[] = []
    const sources = chapter.sources.map((content, index) => {
      const projectPath = `adv/chapters/${chapter.id}/${index + 1}.adv.md`
      files[projectPath] = content
      paths.push(projectPath)
      return `chapters/${chapter.id}/${index + 1}.adv.md`
    })
    sourcePaths.push(paths)
    return { id: chapter.id, title: chapter.title, sources }
  })
  files['adv/settings/game.json'] = JSON.stringify({
    entryChapterId: input.entryChapterId,
    requiredPlugins: input.requiredPlugins,
    variables: input.variables,
    chapters,
  })
  return { files, sourcePaths }
}
