export type { RecentProject } from '../workspaces/browser-session'

export function useRecentProjects() {
  const projectStore = useProjectStore()
  return {
    recentProjects: computed(() => projectStore.recentProjects),
    reopenRecentProject: projectStore.reopenRecentProject,
    removeRecentProject: projectStore.removeRecentProject,
  }
}
