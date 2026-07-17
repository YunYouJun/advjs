import { useRouter } from 'vue-router'
import { useAppStore } from '../stores'

/**
 * Common actions for project-defined start pages.
 *
 * Themes may wrap these actions in their own menu model, while games can build
 * a completely custom start page without depending on a specific theme store.
 */
export function useAdvStartActions() {
  const router = useRouter()
  const app = useAppStore()

  return {
    startGame: () => router.push('/game'),
    openLoadGame: () => app.toggleShowLoadMenu(),
    openFlowChart: () => router.push('/flow-chart'),
    openSettings: () => {
      app.menus.settings = true
    },
    openHelp: () => router.push('/help'),
  }
}
