const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('advDesktop', Object.freeze({
  version: 1,
  // Sandboxed preloads expose process.platform but cannot require the Node process module.
  // eslint-disable-next-line node/prefer-global/process
  nativeMenu: process.platform === 'darwin',
  prepareToLeave: () => ipcRenderer.invoke('desktop:prepare-leave'),
  reconnect: () => ipcRenderer.invoke('desktop:reconnect'),
  preview: () => ipcRenderer.invoke('desktop:preview'),
  stopPreview: () => ipcRenderer.invoke('desktop:preview-stop'),
  exportGame: kind => ipcRenderer.invoke('desktop:export', kind),
  taskStatus: () => ipcRenderer.invoke('desktop:task-status'),
  cancelTask: () => ipcRenderer.invoke('desktop:task-cancel'),
  revealOutput: () => ipcRenderer.invoke('desktop:reveal'),
  openProject: () => ipcRenderer.invoke('desktop:open'),
  closeProject: () => ipcRenderer.invoke('desktop:close'),
  recentProjects: () => ipcRenderer.invoke('desktop:recent'),
  openRecent: id => ipcRenderer.invoke('desktop:open-recent', id),
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
