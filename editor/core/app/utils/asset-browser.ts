import type { TreeNode } from '@advjs/gui'
import { projectFileKind, projectFileTree } from './project-files'

export const ASSET_BROWSER_STATE_KEY = 'advjs:editor:assets:v1'
export interface AssetBrowserPreferences {
  version: 1
  folder: string
  sidebarVisible: boolean
  sidebarWidth: number
  mode: 'grid' | 'list'
  scope: 'folder' | 'all'
}

export function isProjectAsset(path: string) {
  return ['image', 'audio', 'video', 'model'].includes(projectFileKind(path))
}

export function assetParentFolder(path: string) {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')))
}

export function assetFolders(paths: readonly string[]) {
  const folders = new Set([''])
  for (const path of paths) {
    let folder = assetParentFolder(path)
    while (folder) {
      folders.add(folder)
      folder = assetParentFolder(folder)
    }
  }
  return folders
}

export function assetDirectoryTree(paths: readonly string[], expanded: ReadonlySet<string>): TreeNode[] {
  function directories(nodes: TreeNode[]): TreeNode[] {
    return nodes.filter(node => node.kind === 'directory').map(node => ({ ...node, children: directories(node.children ?? []) }))
  }
  return directories(projectFileTree(paths, expanded))
}

export function availableAssetFolder(folder: string, folders: ReadonlySet<string>) {
  while (folder && !folders.has(folder))
    folder = assetParentFolder(folder)
  return folder
}

export function filterProjectAssets(paths: readonly string[], options: { folder: string, scope: 'folder' | 'all', type: string, query: string }) {
  const query = options.query.trim().toLocaleLowerCase()
  return paths.filter(path => (options.scope === 'all' || !options.folder || path.startsWith(`${options.folder}/`))
    && (options.type === 'all' || projectFileKind(path) === options.type)
    && path.toLocaleLowerCase().includes(query))
}

export function restoreAssetBrowserPreferences(value: unknown): AssetBrowserPreferences {
  const stored = value && typeof value === 'object' ? value as Partial<AssetBrowserPreferences> : {}
  return {
    version: 1,
    folder: typeof stored.folder === 'string' ? stored.folder : '',
    sidebarVisible: stored.sidebarVisible !== false,
    sidebarWidth: typeof stored.sidebarWidth === 'number' && Number.isFinite(stored.sidebarWidth) ? Math.min(360, Math.max(140, stored.sidebarWidth)) : 200,
    mode: stored.mode === 'list' ? 'list' : 'grid',
    scope: stored.scope === 'all' ? 'all' : 'folder',
  }
}
