import type { DesktopProjects, DesktopStatus } from '../types/desktop'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useDesktopStore = defineStore('editor:desktop', () => {
  const status = shallowRef<DesktopStatus>({ connected: false, dirty: false, hasProject: false })
  const projects = shallowRef<DesktopProjects>({ opened: [], recent: [] })
  const switcherOpen = shallowRef(false)
  const taskDetailsOpen = shallowRef(false)
  async function refreshProjects() {
    try {
      if (window.advDesktop)
        projects.value = await window.advDesktop.projects()
    }
    catch (error) {
      // A refresh sent just before project replacement can belong to the old
      // renderer session. Retain its last snapshot until navigation completes.
      useConsoleStore().warn('Project window list unavailable', { error })
    }
  }
  return { status, projects, switcherOpen, taskDetailsOpen, refreshProjects }
})
