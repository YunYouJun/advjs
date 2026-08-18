import type { ProjectSourcePatch } from '@advjs/core'
import type { ProjectWorkspace, ProjectWorkspaceSnapshot } from '../../workspaces/project'
import type { LocalBridgeAdapter } from './index'
import { applyProjectPatches } from '@advjs/core'
import { createEditorProjectModel } from '../browser/project'

export function createLocalProjectWorkspace(adapter: LocalBridgeAdapter): ProjectWorkspace {
  async function snapshot(): Promise<ProjectWorkspaceSnapshot> {
    const loaded = await adapter.loadProject()
    const name = loaded.root.split(/[\\/]/u).filter(Boolean).at(-1) ?? 'project'
    const project = createEditorProjectModel(loaded.result, loaded.files)
    project.previewConfig = await adapter.resolvePreviewConfig(
      project.compilation,
      project.previewConfig,
    )
    return {
      kind: 'local',
      name,
      project,
      root: adapter.createDirectoryHandle(loaded.files, name),
    }
  }

  async function commit(patches: readonly ProjectSourcePatch[]) {
    const current = await snapshot()
    const result = applyProjectPatches(current.project.files, patches)
    await Promise.all(result.changedPaths.map(path => adapter.writeFile(path, result.files[path])))
    return await snapshot()
  }

  return {
    kind: 'local',
    commit,
    snapshot,
    subscribe: listener => adapter.watch(listener),
  }
}
