import { useRouter } from 'vue-router'
import { useAppStore, useGameStore } from '../stores'
import { useAdvContext } from './useAdvContext'

export interface AdvStartTarget {
  chapterId: string
  nodeId?: string
}

/**
 * Common actions for project-defined start pages.
 *
 * Themes may wrap these actions in their own menu model, while games can build
 * a completely custom start page without depending on a specific theme store.
 */
export function useAdvStartActions() {
  const router = useRouter()
  const app = useAppStore()
  const game = useGameStore()
  const { $adv } = useAdvContext()

  return {
    startGame: (target?: AdvStartTarget) => {
      game.pendingRestore = undefined
      // Start audio within the original user gesture, before mounting the game.
      try {
        void $adv.$audio.unlock().catch(() => {})
      }
      catch { /* Audio access must not prevent navigation. */ }
      return router.push({
        path: '/game',
        ...(target
          ? {
              query: {
                chapter: target.chapterId,
                ...(target.nodeId ? { node: target.nodeId } : {}),
              },
            }
          : {}),
      })
    },
    openLoadGame: () => app.toggleShowLoadMenu(),
    openFlowChart: () => router.push('/flow-chart'),
    openSettings: () => {
      app.menus.settings = true
    },
    openHelp: () => router.push('/help'),
  }
}
