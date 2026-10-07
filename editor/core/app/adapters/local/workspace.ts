import type { ProjectSourcePatch } from '@advjs/core'
import type { ProjectWorkspace, ProjectWorkspaceSnapshot } from '../../workspaces/project'
import type { LocalBridgeAdapter } from './index'
import { applyProjectPatches } from '@advjs/core'
import { createEditorProjectModel } from '../browser/project'

export function createLocalProjectWorkspace(adapter: LocalBridgeAdapter): ProjectWorkspace {
  let last: ProjectWorkspaceSnapshot | undefined
  async function snapshot(): Promise<ProjectWorkspaceSnapshot> {
    const loaded = await adapter.loadProject()
    const name = loaded.root.split(/[\\/]/u).filter(Boolean).at(-1) ?? 'project'
    const project = createEditorProjectModel(loaded.result, loaded.files)
    project.filePaths = loaded.filePaths
    project.previewConfig = await adapter.resolvePreviewConfig(
      project.compilation,
      project.previewConfig,
    )
    last = {
      kind: 'local',
      name,
      project,
      root: adapter.createDirectoryHandle(loaded.files, name, loaded.filePaths),
    }
    return last
  }

  async function commit(patches: readonly ProjectSourcePatch[]) {
    const current = last ?? await snapshot()
    const result = applyProjectPatches(current.project.files, patches)
    await adapter.writeFiles(result.changedPaths.map(path => ({ path, content: result.files[path], expected: current.project.files[path] ?? null })))
    return await snapshot()
  }

  return {
    kind: 'local',
    commit,
    snapshot,
    writeFiles: async (changes) => {
      await adapter.writeFiles(changes)
      return await snapshot()
    },
    importAsset: adapter.importAsset,
    removeImportedAsset: adapter.removeImportedAsset,
    assetUrl: adapter.readAssetBlobUrl,
    readAsset: adapter.readAsset,
    dispose: adapter.dispose,
    subscribe: listener => adapter.watch(listener),
  }
}
