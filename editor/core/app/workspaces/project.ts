import type { ProjectSourcePatch } from '@advjs/core'
import type { BrowserProjectDirectory, EditorProjectModel } from '../adapters/browser/project'

export type ProjectWorkspaceKind = 'browser' | 'local'

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
  subscribe?: (listener: (change: ProjectWorkspaceChange) => void) => ProjectWorkspaceSubscription
}
