import type { ProjectSourcePatch } from '@advjs/core'
import type { ProjectFileChange, ProjectWorkspace, ProjectWorkspaceSnapshot } from '../../workspaces/project'
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
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<WritableBrowserProjectDirectory>
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<WritableBrowserProjectFile>
  removeEntry: (name: string) => Promise<void>
}

async function getFileHandle(root: WritableBrowserProjectDirectory, path: string, create = false) {
  if (!path || path.startsWith('/') || path.split('/').some(part => ['..', '.git', 'node_modules'].includes(part)))
    throw new Error('Unsafe project path')
  const segments = path.split('/').filter(Boolean)
  const fileName = segments.pop()
  if (!fileName)
    throw new Error(`Project file path is required: ${path}`)
  let directory = root
  for (const segment of segments)
    directory = await directory.getDirectoryHandle(segment, { create })
  return await directory.getFileHandle(fileName, { create })
}

export function createBrowserProjectWorkspace(root: BrowserProjectDirectory): ProjectWorkspace {
  const writableRoot = root as WritableBrowserProjectDirectory
  const assetUrls = new Set<string>()
  let last: ProjectWorkspaceSnapshot | undefined

  async function snapshot(): Promise<ProjectWorkspaceSnapshot> {
    const files = await readBrowserProjectFiles(root)
    last = {
      kind: 'browser',
      name: root.name,
      project: await compileEditorProject({ files, id: root.name }),
      root,
    }
    return last
  }

  async function commit(patches: readonly ProjectSourcePatch[]) {
    const current = last ?? await snapshot()
    const result = applyProjectPatches(current.project.files, patches)
    await writeFiles(result.changedPaths.map(path => ({ path, content: result.files[path], expected: current.project.files[path] ?? null })))
    return await snapshot()
  }

  async function writeFiles(changes: ProjectFileChange[]) {
    const current = await readBrowserProjectFiles(root)
    for (const change of changes) {
      if (!change.path || change.path.startsWith('/') || change.path.includes('\\') || change.path.split('/').some(part => ['..', '.git', 'node_modules'].includes(part)))
        throw new Error('Unsafe project path')
      if ((current[change.path] ?? null) !== change.expected)
        throw new Error(`External changes conflict with the draft: ${change.path}`)
    }
    const written: ProjectFileChange[] = []
    async function write(path: string, content: string | null) {
      if (content === null) {
        const parts = path.split('/')
        const name = parts.pop()!
        let parent = writableRoot
        for (const part of parts) parent = await parent.getDirectoryHandle(part)
        await parent.removeEntry(name)
      }
      else {
        const writer = await (await getFileHandle(writableRoot, path, true)).createWritable()
        await writer.write(content)
        await writer.close()
      }
    }
    try {
      for (const change of changes) {
        await write(change.path, change.content)
        written.push(change)
      }
    }
    catch (error) {
      for (const change of written.reverse()) {
        const latest = await readBrowserProjectFiles(root)
        if ((latest[change.path] ?? null) === change.content)
          await write(change.path, change.expected)
      }
      throw error
    }
    return await snapshot()
  }

  return {
    kind: 'browser',
    commit,
    snapshot,
    writeFiles,
    async importAsset(path, file) {
      try {
        await getFileHandle(writableRoot, path)
        throw new Error(`Asset already exists: ${path}`)
      }
      catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'NotFoundError')
          throw error
      }
      const writer = await (await getFileHandle(writableRoot, path, true)).createWritable()
      await writer.write(file)
      await writer.close()
    },
    async readAsset(path) {
      return await (await getFileHandle(writableRoot, path)).getFile() as Blob
    },
    async removeImportedAsset(path, imported) {
      const file = await (await getFileHandle(writableRoot, path)).getFile() as Blob
      const digest = async (blob: Blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].join(',')
      if (await digest(file) !== await digest(imported))
        throw new Error('Asset changed externally; cleanup refused')
      const parts = path.split('/')
      const name = parts.pop()!
      let parent = writableRoot
      for (const part of parts) parent = await parent.getDirectoryHandle(part)
      await parent.removeEntry(name)
    },
    async assetUrl(path) {
      const file = await (await getFileHandle(writableRoot, path)).getFile()
      const url = URL.createObjectURL(file as Blob)
      assetUrls.add(url)
      return url
    },
    dispose() {
      for (const url of assetUrls) URL.revokeObjectURL(url)
      assetUrls.clear()
    },
  }
}
