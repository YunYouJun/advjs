import type { Ref } from 'vue'
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { useAudioElementClock } from './useAudioElementClock'

/** All controls operate on the same media element used by the transcript clock. */
export function useAudioTransport(element: Readonly<Ref<HTMLAudioElement | null>>) {
  const clock = useAudioElementClock(element)
  const time = clock.time
  const duration = shallowRef(0)
  const paused = shallowRef(true)
  const volume = shallowRef(1)
  const muted = shallowRef(false)
  const rate = shallowRef(1)
  const waiting = shallowRef(false)
  const error = shallowRef('')
  let generation = 0
  let detach = () => {}
  function sync() {
    const audio = element.value
    if (!audio)
      return
    duration.value = Number.isFinite(audio.duration) ? Math.max(0, audio.duration) : 0
    paused.value = audio.paused || audio.ended
    volume.value = audio.volume
    muted.value = audio.muted
    rate.value = audio.playbackRate
  }

  function pause() {
    generation++
    element.value?.pause()
    sync()
    clock.sync()
    waiting.value = false
  }
  function reset() {
    pause()
    duration.value = 0
    paused.value = true
    error.value = ''
  }
  async function play() {
    const audio = element.value
    if (!audio)
      return false
    const current = ++generation
    waiting.value = true
    error.value = ''
    try {
      const started = audio.play()
      sync()
      await started
      return current === generation
    }
    catch (cause) {
      if (current === generation)
        error.value = cause instanceof Error && cause.name === 'NotAllowedError' ? '请点击播放，允许浏览器播放声音。' : '播放未能开始，请重新载入试听。'
      return false
    }
    finally {
      if (current === generation)
        waiting.value = false
    }
  }
  function seek(value: number) {
    if (element.value && duration.value > 0 && Number.isFinite(value)) {
      element.value.currentTime = Math.min(duration.value, Math.max(0, value))
      clock.sync()
    }
  }
  function skip(seconds: number) {
    if (element.value)
      seek(element.value.currentTime + seconds)
  }
  function setVolume(value: number) {
    if (element.value && Number.isFinite(value)) {
      element.value.volume = Math.min(1, Math.max(0, value))
      element.value.muted = false
      sync()
    }
  }
  function toggleMute() {
    if (element.value) {
      element.value.muted = !element.value.muted
      sync()
    }
  }
  function setRate(value: string | number) {
    const next = Number(value)
    if (element.value && [0.75, 1, 1.25, 1.5, 2].includes(next)) {
      element.value.playbackRate = next
      sync()
    }
  }
  watch(element, (audio) => {
    detach()
    reset()
    if (!audio)
      return
    const buffer = () => waiting.value = true
    const ready = () => waiting.value = false
    const failed = () => {
      waiting.value = false
      error.value = '无法载入音频，请重新载入试听。'
    }
    const events = ['loadedmetadata', 'durationchange', 'play', 'pause', 'ended', 'volumechange', 'ratechange', 'emptied'] as const
    events.forEach(event => audio.addEventListener(event, sync))
    audio.addEventListener('waiting', buffer)
    audio.addEventListener('playing', ready)
    audio.addEventListener('canplay', ready)
    audio.addEventListener('error', failed)
    detach = () => {
      events.forEach(event => audio.removeEventListener(event, sync))
      audio.removeEventListener('waiting', buffer)
      audio.removeEventListener('playing', ready)
      audio.removeEventListener('canplay', ready)
      audio.removeEventListener('error', failed)
      audio.pause()
    }
    sync()
  }, { immediate: true })
  onBeforeUnmount(() => {
    generation++
    detach()
  })
  return { time, duration, paused, volume, muted, rate, waiting, error, reset, play, pause, seek, skip, setVolume, toggleMute, setRate }
}
