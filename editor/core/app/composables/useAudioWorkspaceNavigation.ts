import type { AdvContext } from '../../../../packages/client/types/context'
import { computed, inject } from 'vue'
import { editorLayoutStateKey } from '../extensions/layout-state'
import { useAudioStore } from '../stores/useAudioStore'

/** Only changes existing Editor views; generation and adoption remain explicit. */
export function useAudioWorkspaceNavigation() {
  const layout = inject(editorLayoutStateKey, undefined)
  const adv = inject<AdvContext | undefined>('$advjs-context', undefined)
  const audio = useAudioStore()
  const available = computed(() => Boolean(layout && audio.supportedRoot))
  return {
    available,
    open(tab: 'design' | 'jobs' | 'voice', speakerId?: string) {
      if (!available.value)
        return
      audio.requestWorkspace(tab, speakerId)
      layout!.select('main', 'advjs.core/audio')
    },
    async preview() {
      if (!available.value)
        return
      // Start the existing audio protocol inside the author's actual click.
      const unlocking = adv?.$audio.unlock()
      layout!.select('main', 'advjs.core/game')
      await unlocking
    },
  }
}
