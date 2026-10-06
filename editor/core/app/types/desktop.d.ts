export interface DesktopTask { id: string, kind: string, state: 'running' | 'succeeded' | 'failed' | 'cancelled', logs: string, output?: string, error?: string }
export interface DesktopHost {
  version: 1
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
  setDirty: (dirty: boolean) => Promise<void>
  onCommand: (callback: (command: string) => Promise<boolean>) => () => void
}
declare global {
  interface Window { advDesktop?: DesktopHost }
}
