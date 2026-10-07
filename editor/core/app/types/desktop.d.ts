import type { DesktopCommand } from '../../../../apps/desktop/src/commands'
import type { DesktopNotice } from '../../../../apps/desktop/src/editor-window'
import type { PreviewMode, PreviewPresentation, PreviewRunMode } from '../../../../apps/desktop/src/preview-presentation'
import type { DesktopWorkspaceState } from '../../../../apps/desktop/src/workspace-state'
import type { ProjectCreationDefaults, ProjectCreationInput, ProjectCreationResult } from '../utils/project-creation'

export type { DesktopFilePosition, DesktopWorkspaceState } from '../../../../apps/desktop/src/workspace-state'
export interface DesktopProjects { opened: { id: string, name: string, path: string, current: boolean }[], recent: DesktopRecentProject[] }
export interface DesktopStatus { connected: boolean, dirty: boolean, hasProject: boolean, task?: DesktopTask, preview?: PreviewPresentation }
export type DesktopEvent = { type: 'projects-changed' } | { type: 'error', notice: DesktopNotice } | { type: 'create-project', templateId: string } | { type: 'preview-in-editor' }

export interface DesktopTask { id: string, kind: string, state: 'running' | 'succeeded' | 'failed' | 'cancelled', logs: string, output?: string, error?: string }
export interface DesktopRecentProject { id: string, name: string, path: string, lastOpenedAt?: number }
export interface DesktopHost {
  version: 1
  nativeMenu: boolean
  ready: () => Promise<DesktopNotice[]>
  status: () => Promise<DesktopStatus>
  projects: () => Promise<DesktopProjects>
  focusProject: (id: string) => Promise<boolean>
  newWindow: () => Promise<boolean>
  workspaceState: () => Promise<DesktopWorkspaceState>
  saveWorkspaceState: (state: DesktopWorkspaceState) => Promise<void>
  onEvent: (callback: (event: DesktopEvent) => void) => () => void
  prepareToLeave: () => Promise<boolean>
  reconnect: () => Promise<boolean>
  preview: (runMode?: PreviewRunMode) => Promise<DesktopTask | undefined>
  setPreviewPresentation: (mode: PreviewMode) => Promise<void>
  setPreviewBounds: (bounds?: { x: number, y: number, width: number, height: number }) => Promise<void>
  stopPreview: () => Promise<void>
  exportGame: (kind: 'directory' | 'zip') => Promise<DesktopTask | undefined>
  taskStatus: () => Promise<DesktopTask | undefined>
  cancelTask: () => Promise<void>
  revealOutput: () => Promise<void>
  openProject: (target?: 'auto' | 'current') => Promise<boolean>
  projectCreationDefaults: (templateId: string) => Promise<ProjectCreationDefaults>
  selectProjectCreationDirectory: () => Promise<string | undefined>
  createProject: (templateId: string, options: ProjectCreationInput) => Promise<ProjectCreationResult>
  openDocumentation: () => Promise<void>
  closeProject: () => Promise<boolean>
  recentProjects: () => Promise<DesktopRecentProject[]>
  openRecent: (id: string, target?: 'auto' | 'current') => Promise<boolean>
  removeRecent: (id: string) => Promise<void>
  copyErrorReport: (report: string) => Promise<void>
  session: () => Promise<{ origin: string, token: string, root?: string }>
  preferences: () => Promise<{ locale?: 'en' | 'zh-CN', onboarded: boolean, previewVueDevtools?: boolean }>
  setPreferences: (preferences: { locale?: 'en' | 'zh-CN', onboarded?: boolean, previewVueDevtools?: boolean }) => Promise<void>
  setDirty: (dirty: boolean) => Promise<void>
  onCommand: (callback: (command: DesktopCommand) => Promise<boolean>) => () => void
}
declare global {
  interface Window { advDesktop?: DesktopHost }
}
