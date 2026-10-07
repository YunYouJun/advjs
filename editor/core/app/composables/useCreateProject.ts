import type { ProjectTemplateMeta } from '../templates'
import { consola } from 'consola'
import { PROJECT_TEMPLATE_LIST } from '../templates'

export type { ProjectTemplateMeta }

export const PROJECT_TEMPLATES: ProjectTemplateMeta[] = PROJECT_TEMPLATE_LIST.map(t => t.meta)

const RE_PROJECT_NAME = /\{\{projectName\}\}/g

/**
 * Recursively resolve (or create) subdirectories for a nested path,
 * then create the file in the final directory.
 *
 * e.g. `assets/characters/a.character.md` →
 *   dirHandle / assets / characters / a.character.md
 */
async function writeFile(dirHandle: FileSystemDirectoryHandle, filePath: string, content: string | Uint8Array<ArrayBuffer>) {
  const segments = filePath.split('/')
  const fileName = segments.pop()!

  // walk / create intermediate directories
  let current = dirHandle
  for (const dir of segments)
    current = await current.getDirectoryHandle(dir, { create: true })

  const fileHandle = await current.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
  return fileHandle
}

/**
 * Check if a directory already contains any of the template files.
 * Returns the list of conflicting file names.
 */
async function findConflicts(
  dirHandle: FileSystemDirectoryHandle,
  filePaths: string[],
): Promise<string[]> {
  const conflicts: string[] = []
  for (const filePath of filePaths) {
    try {
      const segments = filePath.split('/')
      const fileName = segments.pop()!

      let current = dirHandle
      let dirExists = true
      for (const dir of segments) {
        try {
          current = await current.getDirectoryHandle(dir)
        }
        catch {
          dirExists = false
          break
        }
      }
      if (!dirExists)
        continue

      // will throw if file does not exist
      await current.getFileHandle(fileName)
      conflicts.push(filePath)
    }
    catch {
      // file doesn't exist – no conflict
    }
  }
  return conflicts
}

export function useCreateProject() {
  const projectStore = useProjectStore()
  const desktopCreation = useDesktopProjectCreation()

  const isCreating = useState('editor:creating-project', () => false)

  async function createAndLoadProject(templateId: string) {
    if (window.advDesktop)
      return await desktopCreation.begin(templateId)
    if (isCreating.value)
      return

    isCreating.value = true

    try {
      const template = PROJECT_TEMPLATE_LIST.find(item => item.meta.id === templateId)
      if (!template) {
        throw new Error(`Unknown template: ${templateId}`)
      }
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })

      // Check for existing files that would be overwritten
      const fileNames = template.files.map(f => f.name)
      const conflicts = await findConflicts(dirHandle, fileNames)

      if (conflicts.length > 0) {
        // eslint-disable-next-line no-alert
        const confirmed = window.confirm(
          `The selected directory already contains the following files:\n\n`
          + `${conflicts.join('\n')}\n\n`
          + `These files will be overwritten. Continue?`,
        )
        if (!confirmed) {
          return
        }
      }

      for (const file of template.files) {
        const name = file.name.endsWith('.json') ? JSON.stringify(dirHandle.name).slice(1, -1) : dirHandle.name
        const content = file.encoding === 'base64' ? Uint8Array.from(atob(file.content), character => character.charCodeAt(0)) : file.content.replace(RE_PROJECT_NAME, () => name)
        await writeFile(dirHandle, file.name, content)
      }

      await projectStore.openBrowserProject(dirHandle, { templateId })

      consola.success(`Project created: ${dirHandle.name} (${templateId})`)
    }
    catch (err: unknown) {
      // User cancelled directory picker
      if (err instanceof DOMException && err.name === 'AbortError')
        return
      consola.error('Failed to create project', err)
      useConsoleStore().error('无法创建项目', { error: err, templateId })
    }
    finally {
      isCreating.value = false
    }
  }

  return {
    isCreating,
    createAndLoadProject,
  }
}
