import type { ShallowRef } from 'vue'
import type { AdvContext } from '../types'
import { QUICK_SAVE_SLOT, useGameStore } from '@advjs/client'
import { shallowRef } from 'vue'

/** Message keys under `controls.*` in `useGameControlsI18n`. */
export type QuickSaveFeedback = '' | 'quickSaved' | 'quickSaveFailed' | 'quickLoaded' | 'quickLoadFailed' | 'quickEmpty'

export interface AdvQuickSave {
  busy: ShallowRef<boolean>
  feedback: ShallowRef<QuickSaveFeedback>
  quickSave: () => Promise<void>
  quickLoad: () => Promise<void>
  cancel: () => void
}

// Buttons and shortcuts share one state, so a key press shows the same feedback as a click.
const instances = new WeakMap<object, AdvQuickSave>()

export function useAdvQuickSave($adv: AdvContext): AdvQuickSave {
  const existing = instances.get($adv)
  if (existing)
    return existing

  const game = useGameStore()
  const busy = shallowRef(false)
  const feedback = shallowRef<QuickSaveFeedback>('')
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined
  let generation = 0

  function showFeedback(message: QuickSaveFeedback) {
    feedback.value = message
    if (feedbackTimer)
      clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => {
      feedback.value = ''
    }, 1800)
  }

  async function run(task: (isCurrent: () => boolean) => Promise<QuickSaveFeedback>, failure: QuickSaveFeedback) {
    const program = $adv.runtime.program.value
    if (busy.value || !program || $adv.store.state.status === 'idle')
      return
    const operation = ++generation
    const namespace = game.recordNamespace
    const preview = game.previewMode
    const isCurrent = () => operation === generation && $adv.runtime.program.value === program
      && game.recordNamespace === namespace && game.previewMode === preview
    busy.value = true
    try {
      const result = await task(isCurrent)
      if (isCurrent())
        showFeedback(result)
    }
    catch (error) {
      if (isCurrent()) {
        console.error(`[advjs] ${failure === 'quickSaveFailed' ? 'Quick save' : 'Quick load'} failed`, error)
        showFeedback(failure)
      }
    }
    finally {
      if (operation === generation)
        busy.value = false
    }
  }

  const instance: AdvQuickSave = {
    busy,
    feedback,
    quickSave: () => run(async () => {
      await game.save(QUICK_SAVE_SLOT, $adv.runtime.snapshot())
      return 'quickSaved'
    }, 'quickSaveFailed'),
    quickLoad: () => run(async (isCurrent) => {
      const record = await game.read(QUICK_SAVE_SLOT)
      if (!record || !isCurrent())
        return 'quickEmpty'
      $adv.runtime.restore(record.snapshot)
      return 'quickLoaded'
    }, 'quickLoadFailed'),
    cancel() {
      generation++
      busy.value = false
      feedback.value = ''
      if (feedbackTimer !== undefined)
        clearTimeout(feedbackTimer)
    },
  }
  instances.set($adv, instance)
  return instance
}
