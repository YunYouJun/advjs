import { useStorage } from '@vueuse/core'

export interface RecentProject {
  name: string
  templateId: string
  lastOpenedAt: number
}

const MAX_RECENT_PROJECTS = 10

export function useRecentProjects() {
  const recentProjects = useStorage<RecentProject[]>('advjs:editor:recent-projects', [])

  function addRecentProject(project: Omit<RecentProject, 'lastOpenedAt'>) {
    const existing = recentProjects.value.findIndex(p => p.name === project.name)
    if (existing !== -1)
      recentProjects.value.splice(existing, 1)

    recentProjects.value.unshift({
      ...project,
      lastOpenedAt: Date.now(),
    })

    if (recentProjects.value.length > MAX_RECENT_PROJECTS)
      recentProjects.value = recentProjects.value.slice(0, MAX_RECENT_PROJECTS)
  }

  function removeRecentProject(name: string) {
    recentProjects.value = recentProjects.value.filter(p => p.name !== name)
  }

  return {
    recentProjects,
    addRecentProject,
    removeRecentProject,
  }
}
