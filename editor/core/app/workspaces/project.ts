import type { ProjectSourcePatch } from '@advjs/core'
import type { AdvAssetManifest, AdvProjectFileMap, AdvVoiceLibrarySnapshot, AdvVoiceSelectInput, VoiceDesignPort } from '@advjs/types'
import type { EditorVoiceJobsPort } from '../../../../packages/advjs/shared/editor-audio'
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
  /** Stable noncredential project identity, never a bridge origin or token. */
  recoveryId?: string
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
  /** Local voice review uses registered native audio and revision-checked selection. */
  voiceLibrary?: (signal?: AbortSignal) => Promise<AdvVoiceLibrarySnapshot>
  selectVoiceSample?: (input: AdvVoiceSelectInput) => Promise<AdvVoiceLibrarySnapshot>
  readVoiceAudio?: (assetId: string, signal?: AbortSignal) => Promise<Blob>
  /** Durable local jobs; hosted workspaces must inject a configured service explicitly. */
  voiceJobs?: EditorVoiceJobsPort
  voiceDesign?: VoiceDesignPort
  voiceMaintenance?: import('@advjs/types').VoiceProviderMaintenancePort
  voiceAlignment?: import('@advjs/types').VoiceAlignmentPort
  commit: (patches: readonly ProjectSourcePatch[]) => Promise<ProjectWorkspaceSnapshot>
  snapshot: () => Promise<ProjectWorkspaceSnapshot>
  /** Authoring reads must not replace or revoke live preview media URLs. */
  readDocuments?: () => Promise<{ files: AdvProjectFileMap, catalog?: AdvAssetManifest }>
  writeFiles?: (changes: ProjectFileChange[]) => Promise<ProjectWorkspaceSnapshot>
  importAsset?: (path: string, file: Blob) => Promise<void>
  removeImportedAsset?: (path: string, file: Blob) => Promise<void>
  readAsset?: (path: string) => Promise<Blob>
  assetUrl?: (path: string) => Promise<string>
  dispose?: () => void
  subscribe?: (listener: (change: ProjectWorkspaceChange) => void) => ProjectWorkspaceSubscription
}
