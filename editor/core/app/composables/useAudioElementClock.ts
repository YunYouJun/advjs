import type { Ref } from 'vue'
import { onBeforeUnmount, readonly, shallowRef, watch } from 'vue'

/** Read the actual media clock; pauses and seeks never use wall-clock estimates. */
export function useAudioElementClock(element: Readonly<Ref<HTMLAudioElement | null>>) {
  const time = shallowRef(0)
  let frame: number | undefined
  let detach = () => {}
  function sync() {
    const audio = element.value
    time.value = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0
  }
  function stop() {
    if (frame !== undefined)
      cancelAnimationFrame(frame)
    frame = undefined
  }
  watch(element, (audio) => {
    detach()
    stop()
    time.value = 0
    if (!audio)
      return
    const tick = () => {
      sync()
      frame = !audio.paused && !audio.ended ? requestAnimationFrame(tick) : undefined
    }
    const update = () => {
      stop()
      tick()
    }
    const events = ['play', 'pause', 'seeking', 'seeked', 'timeupdate', 'loadedmetadata', 'ended'] as const
    events.forEach(event => audio.addEventListener(event, update))
    detach = () => events.forEach(event => audio.removeEventListener(event, update))
    update()
  }, { immediate: true })
  onBeforeUnmount(() => {
    detach()
    stop()
  })
  return { time: readonly(time), sync }
}
