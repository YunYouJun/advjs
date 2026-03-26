import type { FSDirItem } from '@advjs/gui'
import type { ProjectTemplateMeta } from '../templates'
import { Toast } from '@advjs/gui'
import { consola } from 'consola'
import { PROJECT_TEMPLATE_LIST, PROJECT_TEMPLATE_MAP } from '../templates'

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
async function writeFile(dirHandle: FileSystemDirectoryHandle, filePath: string, content: string) {
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
  const { addRecentProject } = useRecentProjects()

  const isCreating = ref(false)

  async function createAndLoadProject(templateId: string) {
    if (isCreating.value)
      return

    isCreating.value = true

    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })

      const template = PROJECT_TEMPLATE_MAP[templateId]
      if (!template) {
        consola.error(`Unknown template: ${templateId}`)
        return
      }

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
          Toast({
            title: 'Cancelled',
            description: 'Project creation cancelled',
            type: 'warning',
          })
          return
        }
      }

      let advConfigFileHandle: FileSystemFileHandle | undefined
      let entryFileHandle: FileSystemFileHandle | undefined

      for (const file of template.files) {
        const content = file.content.replace(RE_PROJECT_NAME, dirHandle.name)
        const fileHandle = await writeFile(dirHandle, file.name, content)
        if (file.isAdvConfig)
          advConfigFileHandle = fileHandle
        if (file.isEntry)
          entryFileHandle = fileHandle
      }

      // Set rootDir
      projectStore.rootDir = {
        name: dirHandle.name,
        kind: 'directory',
        handle: dirHandle,
      } as FSDirItem

      // Load into editor
      if (advConfigFileHandle)
        await projectStore.setAdvConfigFileHandle(advConfigFileHandle)
      if (entryFileHandle)
        await projectStore.setEntryFileHandle(entryFileHandle)

      // Save to recent projects
      addRecentProject({
        name: dirHandle.name,
        templateId,
      })

      consola.success(`Project created: ${dirHandle.name} (${templateId})`)
    }
    catch (err: unknown) {
      // User cancelled directory picker
      if (err instanceof DOMException && err.name === 'AbortError')
        return
      consola.error('Failed to create project', err)
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
