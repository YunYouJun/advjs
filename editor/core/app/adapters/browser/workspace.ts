import type { ProjectSourcePatch } from '@advjs/core'
import type { ProjectWorkspace, ProjectWorkspaceSnapshot } from '../../workspaces/project'
import type { BrowserProjectDirectory, BrowserProjectFile } from './project'
import { applyProjectPatches } from '@advjs/core'
import { compileEditorProject, readBrowserProjectFiles } from './project'

interface WritableBrowserProjectFile extends BrowserProjectFile {
  createWritable: () => Promise<{
    close: () => Promise<void>
    write: (content: string | Blob) => Promise<void>
  }>
}

interface WritableBrowserProjectDirectory extends BrowserProjectDirectory {
  getDirectoryHandle: (name: string) => Promise<WritableBrowserProjectDirectory>
  getFileHandle: (name: string) => Promise<WritableBrowserProjectFile>
}

async function getFileHandle(root: WritableBrowserProjectDirectory, path: string) {
  const segments = path.split('/').filter(Boolean)
  const fileName = segments.pop()
  if (!fileName)
    throw new Error(`Project file path is required: ${path}`)
  let directory = root
  for (const segment of segments)
    directory = await directory.getDirectoryHandle(segment)
  return await directory.getFileHandle(fileName)
}

export function createBrowserProjectWorkspace(root: BrowserProjectDirectory): ProjectWorkspace {
  const writableRoot = root as WritableBrowserProjectDirectory

  async function snapshot(): Promise<ProjectWorkspaceSnapshot> {
    const files = await readBrowserProjectFiles(root)
    return {
      kind: 'browser',
      name: root.name,
      project: await compileEditorProject({ files, id: root.name }),
      root,
    }
  }

  async function commit(patches: readonly ProjectSourcePatch[]) {
    const current = await snapshot()
    const result = applyProjectPatches(current.project.files, patches)
    await Promise.all(result.changedPaths.map(async (path) => {
      const writable = await (await getFileHandle(writableRoot, path)).createWritable()
      await writable.write(result.files[path])
      await writable.close()
    }))
    return await snapshot()
  }

  return {
    kind: 'browser',
    commit,
    snapshot,
  }
}
