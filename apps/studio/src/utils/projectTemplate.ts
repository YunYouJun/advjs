import type { ProjectTemplateDefinition, ProjectTemplateFile } from '@advjs/core'
import type { IFileSystem } from './fs'
import { createProjectTemplateFiles, getProjectTemplate, projectTemplates, quickStartProjectTemplate } from '@advjs/core'

// Template contents are shared with native Studio through `@advjs/core`.
export type TemplateFile = ProjectTemplateFile
export type TemplateDefinition = ProjectTemplateDefinition
export const templateRegistry = projectTemplates
export const getTemplateById = getProjectTemplate
export const quickStartTemplate = quickStartProjectTemplate

/**
 * Write a list of template files (path + content) into the given file system.
 * Shared by both {@link createProjectFromTemplate} and the Phase M10
 * Source-to-Project pipeline — anything that produces `TemplateFile[]` can
 * persist through this single writer loop.
 *
 * Parent directories are created on demand (IFileSystem.mkdir is idempotent).
 */
export async function writeTemplateFiles(
  fs: IFileSystem,
  files: TemplateFile[],
): Promise<void> {
  for (const file of files) {
    // Ensure parent directories exist
    const parts = file.path.split('/')
    if (parts.length > 1) {
      await fs.mkdir(parts.slice(0, -1).join('/'))
    }
    await fs.writeFile(file.path, file.content)
  }
}

/**
 * Create a new ADV.JS project from template using IFileSystem.
 *
 * @param fs - File system to write files into
 * @param projectName - Name of the project (used in template content)
 * @param templateId - Template ID (defaults to 'visual-novel-starter')
 */
export async function createProjectFromTemplate(
  fs: IFileSystem,
  projectName: string,
  templateId: string = 'visual-novel-starter',
): Promise<void> {
  await writeTemplateFiles(fs, createProjectTemplateFiles(templateId, projectName))
}
