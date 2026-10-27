/**
 * Browser-side project validation.
 *
 * The checks live in `@advjs/core` (`validateProjectContent`) so Studio and
 * the native Studio engine report the same issues; this module supplies
 * Studio's runtime plugins and file access.
 */

import type { ProjectValidationIssue, ProjectValidationResult } from '@advjs/core'
import type { AdvCharacter } from '@advjs/types'
import type {
  AudioInfo,
  ChapterInfo,
  LocationInfo,
  SceneInfo,
} from '../composables/useProjectContent'
import type { IFileSystem } from './fs'
import type { StudioGameSettings } from './projectRuntimeFiles'
import { fixProjectReferences, isFixableProjectIssue, validateProjectContent } from '@advjs/core'
import { createStudioRuntimePlugins } from './studioRuntimePlugins'

export type ValidationIssue = ProjectValidationIssue
export type ValidationResult = ProjectValidationResult

/**
 * Validate a project using in-memory data from useProjectContent.
 * Checks: syntax, character references, scene references, audio link integrity.
 */
export async function validateProject(
  chapters: ChapterInfo[],
  characters: AdvCharacter[],
  scenes: SceneInfo[],
  audios: AudioInfo[],
  locations: LocationInfo[] = [],
  settings: StudioGameSettings = {},
): Promise<ValidationResult> {
  return validateProjectContent({
    chapters,
    characters,
    scenes,
    audios,
    locations,
    requiredPlugins: settings.requiredPlugins,
    plugins: createStudioRuntimePlugins(),
  })
}

/**
 * Auto-fix warning-level issues by removing broken references from YAML frontmatter.
 *
 * Supported fix types:
 * - audio/location: remove broken linkedScenes/linkedChapters/linkedCharacters entries
 * - character: remove broken relationship.targetId entries
 * - scene: remove broken linkedLocation field
 *
 * Returns the list of issues that were successfully fixed.
 */
export async function autoFixIssues(
  issues: ValidationIssue[],
  fs: IFileSystem,
): Promise<ValidationIssue[]> {
  const fixable = issues.filter(isFixableProjectIssue)
  const files: Record<string, string> = {}
  for (const file of new Set(fixable.map(issue => issue.file))) {
    try {
      files[file] = await fs.readFile(file)
    }
    catch {
      // Skip files that can't be read
    }
  }

  const { writes, fixed } = fixProjectReferences(files, fixable)
  const written = new Set<string>()
  for (const [file, content] of Object.entries(writes)) {
    try {
      await fs.writeFile(file, content)
      written.add(file)
    }
    catch {
      // Skip files that can't be written
    }
  }
  return fixed.filter(issue => written.has(issue.file))
}
