const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('advDesktop', Object.freeze({
  version: 1,
  // Sandboxed preloads expose process.platform but cannot require the Node process module.
  // eslint-disable-next-line node/prefer-global/process
  nativeMenu: process.platform === 'darwin',
  ready: () => ipcRenderer.invoke('desktop:ready'),
  status: () => ipcRenderer.invoke('desktop:status'),
  projects: () => ipcRenderer.invoke('desktop:projects'),
  focusProject: id => ipcRenderer.invoke('desktop:focus-project', id),
  newWindow: () => ipcRenderer.invoke('desktop:new-window'),
  workspaceState: () => ipcRenderer.invoke('desktop:workspace-state'),
  saveWorkspaceState: state => ipcRenderer.invoke('desktop:save-workspace-state', state),
  onEvent: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('desktop:event', listener)
    return () => ipcRenderer.removeListener('desktop:event', listener)
  },
  prepareToLeave: () => ipcRenderer.invoke('desktop:prepare-leave'),
  reconnect: () => ipcRenderer.invoke('desktop:reconnect'),
  preview: runMode => ipcRenderer.invoke('desktop:preview', runMode),
  setPreviewPresentation: mode => ipcRenderer.invoke('desktop:preview-presentation', mode),
  setPreviewBounds: bounds => ipcRenderer.invoke('desktop:preview-bounds', bounds),
  stopPreview: () => ipcRenderer.invoke('desktop:preview-stop'),
  exportGame: kind => ipcRenderer.invoke('desktop:export', kind),
  taskStatus: () => ipcRenderer.invoke('desktop:task-status'),
  cancelTask: () => ipcRenderer.invoke('desktop:task-cancel'),
  revealOutput: () => ipcRenderer.invoke('desktop:reveal'),
  openProject: target => ipcRenderer.invoke('desktop:open', target),
  projectCreationDefaults: id => ipcRenderer.invoke('desktop:creation-defaults', id),
  selectProjectCreationDirectory: () => ipcRenderer.invoke('desktop:creation-directory'),
  createProject: (id, options) => ipcRenderer.invoke('desktop:create', id, options),
  openDocumentation: () => ipcRenderer.invoke('desktop:documentation'),
  closeProject: () => ipcRenderer.invoke('desktop:close'),
  recentProjects: () => ipcRenderer.invoke('desktop:recent'),
  openRecent: (id, target) => ipcRenderer.invoke('desktop:open-recent', id, target),
  removeRecent: id => ipcRenderer.invoke('desktop:remove-recent', id),
  copyErrorReport: report => ipcRenderer.invoke('desktop:copy-error-report', report),
  session: () => ipcRenderer.invoke('desktop:session'),
  preferences: () => ipcRenderer.invoke('desktop:preferences'),
  setPreferences: preferences => ipcRenderer.invoke('desktop:set-preferences', preferences),
  setDirty: dirty => ipcRenderer.invoke('desktop:dirty', dirty),
  onCommand: (callback) => {
    const listener = async (_event, id, command) => {
      let success = false
      try {
        success = await callback(command) !== false
      }
      finally {
        await ipcRenderer.invoke('desktop:command-result', id, success)
      }
    }
    ipcRenderer.on('desktop:command', listener)
    return () => ipcRenderer.removeListener('desktop:command', listener)
  },
}))
