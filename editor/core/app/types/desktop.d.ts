import type { DesktopCommand } from '../../../../apps/desktop/src/commands'

export interface DesktopTask { id: string, kind: string, state: 'running' | 'succeeded' | 'failed' | 'cancelled', logs: string, output?: string, error?: string }
export interface DesktopHost {
  version: 1
  nativeMenu: boolean
  prepareToLeave: () => Promise<boolean>
  reconnect: () => Promise<boolean>
  preview: () => Promise<DesktopTask | undefined>
  stopPreview: () => Promise<void>
  exportGame: (kind: 'directory' | 'zip') => Promise<DesktopTask | undefined>
  taskStatus: () => Promise<DesktopTask | undefined>
  cancelTask: () => Promise<void>
  revealOutput: () => Promise<void>
  openProject: () => Promise<boolean>
  closeProject: () => Promise<boolean>
  recentProjects: () => Promise<{ id: string, name: string }[]>
  openRecent: (id: string) => Promise<boolean>
  session: () => Promise<{ origin: string, token: string, root?: string }>
  preferences: () => Promise<{ locale?: 'en' | 'zh-CN', onboarded: boolean }>
  setPreferences: (preferences: { locale?: 'en' | 'zh-CN', onboarded?: boolean }) => Promise<void>
  setDirty: (dirty: boolean) => Promise<void>
  onCommand: (callback: (command: DesktopCommand) => Promise<boolean>) => () => void
}
declare global {
  interface Window { advDesktop?: DesktopHost }
}
