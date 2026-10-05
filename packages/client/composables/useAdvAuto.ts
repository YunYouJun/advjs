import type { AdvContext } from '../types'
import { useStorage } from '@vueuse/core'
import { getCurrentScope, onScopeDispose, shallowRef, watch } from 'vue'

/**
 * Auto-play and skip mode controller.
 *
 * - **Auto mode**: when the typewriter finishes (notifyPrintDone), wait `delay` ms and advance.
 * - **Skip mode**: advance every `skipInterval` ms regardless of typewriter; pauses on choices/end.
 *
 * Both modes are mutually exclusive. Choices and end nodes always halt both.
 */
export function useAdvAuto($adv: AdvContext) {
  const enabled = shallowRef(false)
  const skipEnabled = shallowRef(false)
  const delay = useStorage('advjs-auto-delay', 2000)
  const skipInterval = useStorage('advjs-skip-interval', 80)

  let timer: ReturnType<typeof setTimeout> | null = null
  let printDone = false

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function shouldHalt() {
    const node = $adv.store.current
    if (!node)
      return true
    return node.kind === 'choices' || node.kind === 'end'
  }

  function scheduleAdvance() {
    clearTimer()
    if (shouldHalt()) {
      enabled.value = false
      skipEnabled.value = false
      return
    }
    if (skipEnabled.value) {
      timer = setTimeout(() => $adv.runtime.next(), skipInterval.value)
      return
    }
    if (!enabled.value || !printDone)
      return
    timer = setTimeout(() => $adv.runtime.next(), delay.value)
  }

  /** Remember completion even when auto-play is enabled after the line finishes. */
  function notifyPrintDone() {
    printDone = true
    scheduleAdvance()
  }

  // Skip mode keeps the flow running even if a node has no typewriter
  // (scene transitions, narration without PrintWords, etc.).
  watch(() => $adv.store.current, () => {
    printDone = false
    scheduleAdvance()
  }, { flush: 'sync' })

  watch([enabled, skipEnabled], scheduleAdvance)
  if (getCurrentScope())
    onScopeDispose(clearTimer)

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
