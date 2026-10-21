import type {
  AuthoringOverride,
  AuthoringProgramResult,
  AuthoringProgramRow,
  MarkdownResourceCatalog,
} from '@advjs/core'
import type { ChapterInfo } from '../composables/useProjectContent'
import type { StudioGameSettings } from './projectRuntimeFiles'
import { compileAuthoringProgram, createAuthoringChapterIdMap } from '@advjs/core'
import { createStudioRuntimePlugins } from './studioRuntimePlugins'

export type RuntimeAuthoringOverride = AuthoringOverride
export type RuntimeProgramRow = AuthoringProgramRow
export type RuntimeAuthoringResult = AuthoringProgramResult

export const createStudioChapterIdMap = createAuthoringChapterIdMap

/**
 * Compile the open project with Studio's bundled runtime plugins.
 * The shared implementation lives in `@advjs/core` so native hosts agree.
 */
export async function compileRuntimeAuthoringProject(
  chapters: readonly ChapterInfo[],
  settings: StudioGameSettings,
  override?: RuntimeAuthoringOverride,
  resources?: MarkdownResourceCatalog,
): Promise<RuntimeAuthoringResult> {
  return compileAuthoringProgram({
    chapters,
    requiredPlugins: settings.requiredPlugins,
    plugins: createStudioRuntimePlugins(),
    override,
    resources,
  })
}
