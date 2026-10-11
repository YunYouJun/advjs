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
  const paused = shallowRef(false)
  const delay = useStorage('advjs-auto-delay', 2000)
  const skipInterval = useStorage('advjs-skip-interval', 80)

  let timer: ReturnType<typeof setTimeout> | null = null
  let printDone = false

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function shouldHalt() {
    const node = $adv.store.current
    if (!node)
      return true
    const status = $adv.store.state?.status
    return node.kind === 'choices' || node.kind === 'end'
      || (status !== undefined && status !== 'playing')
  }

  function scheduleAdvance() {
    clearTimer()
    if (shouldHalt()) {
      enabled.value = false
      skipEnabled.value = false
      return
    }
    if (paused.value)
      return
    if (skipEnabled.value) {
      timer = setTimeout(advance, skipInterval.value)
      return
    }
    if (!enabled.value || !printDone)
      return
    timer = setTimeout(advance, delay.value)
  }

  async function advance() {
    timer = null
    if (paused.value || shouldHalt() || (!enabled.value && !skipEnabled.value))
      return
    try {
      await $adv.runtime.next()
    }
    catch (error) {
      stop()
      console.warn('[advjs] Automatic playback stopped', error)
    }
  }

  function stop() {
    enabled.value = false
    skipEnabled.value = false
    clearTimer()
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

  watch([enabled, skipEnabled, paused], scheduleAdvance, { flush: 'sync' })
  watch(() => $adv.store.state?.status, scheduleAdvance, { flush: 'sync' })
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
    paused,
    stop,
    delay,
    skipInterval,
    toggle,
    toggleSkip,
    notifyPrintDone,
  }
}
