import type { ProjectSourcePatch } from '@advjs/core'
import type { BrowserProjectDirectory, EditorProjectModel } from '../adapters/browser/project'

export type ProjectWorkspaceKind = 'browser' | 'local'

export interface ProjectFileChange {
  path: string
  expected: string | null
  content: string | null
}

export interface ProjectWorkspaceChange {
  event: string
  path: string
}

export interface ProjectWorkspaceSnapshot {
  kind: ProjectWorkspaceKind
  name: string
  project: EditorProjectModel
  root: BrowserProjectDirectory
}

export interface ProjectWorkspaceSubscription {
  done: Promise<void>
  stop: () => void
}

/**
 * The single project seam used by the Editor.
 *
 * A commit applies validated source patches and returns a fully recompiled
 * snapshot. Workspaces with live external changes additionally expose a
 * subscription; callers must stop it when replacing the workspace.
 */
export interface ProjectWorkspace {
  readonly kind: ProjectWorkspaceKind
  commit: (patches: readonly ProjectSourcePatch[]) => Promise<ProjectWorkspaceSnapshot>
  snapshot: () => Promise<ProjectWorkspaceSnapshot>
  writeFiles?: (changes: ProjectFileChange[]) => Promise<ProjectWorkspaceSnapshot>
  importAsset?: (path: string, file: Blob) => Promise<void>
  removeImportedAsset?: (path: string, file: Blob) => Promise<void>
  readAsset?: (path: string) => Promise<Blob>
  assetUrl?: (path: string) => Promise<string>
  dispose?: () => void
  subscribe?: (listener: (change: ProjectWorkspaceChange) => void) => ProjectWorkspaceSubscription
}
