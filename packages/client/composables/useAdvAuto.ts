import type { AdvContext } from '../types'
import { useStorage } from '@vueuse/core'
import { ref, watch } from 'vue'

/**
 * Auto-play and skip mode controller.
 *
 * - **Auto mode**: when the typewriter finishes (notifyPrintDone), wait `delay` ms and advance.
 * - **Skip mode**: advance every `skipInterval` ms regardless of typewriter; pauses on choices/end.
 *
 * Both modes are mutually exclusive. Choices and end nodes always halt both.
 */
export function useAdvAuto($adv: AdvContext) {
  const enabled = ref(false)
  const skipEnabled = ref(false)
  const delay = useStorage('advjs-auto-delay', 2000)
  const skipInterval = useStorage('advjs-skip-interval', 80)

  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function shouldHalt() {
    const node = $adv.store.curNode
    if (!node)
      return true
    return node.type === 'choices' || node.type === 'end'
  }

  /**
   * Called by AdvDialogBox when the PrintWords typewriter completes its current run.
   * Drives auto-advance after the configured delay.
   */
  function notifyPrintDone() {
    clearTimer()
    if (shouldHalt())
      return
    if (skipEnabled.value) {
      timer = setTimeout(() => $adv.$nav.next(), skipInterval.value)
      return
    }
    if (!enabled.value)
      return
    timer = setTimeout(() => $adv.$nav.next(), delay.value)
  }

  // Skip mode keeps the flow running even if a node has no typewriter
  // (scene transitions, narration without PrintWords, etc.).
  watch(() => $adv.store.curNode, () => {
    clearTimer()
    if (skipEnabled.value && !shouldHalt())
      timer = setTimeout(() => $adv.$nav.next(), skipInterval.value)
  })

  watch([enabled, skipEnabled], ([e, s]) => {
    if (!e && !s)
      clearTimer()
  })

  function toggle() {
    enabled.value = !enabled.value
    if (enabled.value)
      skipEnabled.value = false
  }

  function toggleSkip() {
    skipEnabled.value = !skipEnabled.value
    if (skipEnabled.value)
      enabled.value = false
  }

  return {
    enabled,
    skipEnabled,
    delay,
    skipInterval,
    toggle,
    toggleSkip,
    notifyPrintDone,
  }
}
