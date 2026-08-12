import type { AdvMusic } from '@advjs/types'
import type { AdvContext } from '../types'

import { getBgmSrcUrl } from '@advjs/core'
import { Howl } from 'howler'
import { ref } from 'vue'

const DEFAULT_FADE_IN = 800
const DEFAULT_FADE_OUT = 600

export interface BgmFadeOptions {
  fade?: number
  fadeIn?: number
  fadeOut?: number
  loop?: boolean
}

type BgmTrackPhase = 'active' | 'paused' | 'retiring'

interface BgmTrack {
  generation: number
  phase: BgmTrackPhase
  sound: Howl
  stopListener?: () => void
}

/**
 * Manages one logical BGM track, plus retiring tracks during crossfades.
 * @param $adv
 */
export function useAdvBgm($adv: AdvContext) {
  const tracks = new Map<string, BgmTrack>()
  let activeSrc: string | undefined

  const volume = ref(0.5)
  const isMuted = ref(false)

  function targetVolume() {
    return isMuted.value ? 0 : volume.value
  }

  /**
   * 获取背景音乐的源地址
   * @param bgmKey 背景音乐的键
   * @returns 背景音乐的源地址
   */
  function getBgmSrc(bgmKey: string) {
    const bgmLibrary = ($adv.gameConfig.value.bgm?.library || {}) as Record<string, AdvMusic>
    const cdnUrl = $adv.config.value.cdn.prefix || 'https://cos.advjs.yunle.fun'
    const bgmName = bgmLibrary[bgmKey]?.src || bgmKey
    return getBgmSrcUrl({ cdnUrl, bgmName })
  }

  function cancelRetirement(track: BgmTrack) {
    const wasRetiring = track.phase === 'retiring'
    track.generation += 1
    if (track.stopListener) {
      track.sound.off('fade', track.stopListener)
      track.stopListener = undefined
    }
    return wasRetiring
  }

  function releaseTrack(src: string, track: BgmTrack, generation?: number) {
    if (tracks.get(src) !== track || (generation !== undefined && track.generation !== generation))
      return
    cancelRetirement(track)
    track.sound.unload()
    tracks.delete(src)
    if (activeSrc === src)
      activeSrc = undefined
  }

  function fadeTo(sound: Howl, from: number, to: number, duration: number) {
    if (duration <= 0 || from === to) {
      sound.volume(to)
      return
    }
    sound.fade(from, to, duration)
  }

  function startTrack(src: string, options: BgmFadeOptions = {}) {
    activeSrc = src
    const fade = options.fade ?? DEFAULT_FADE_IN
    const existingTrack = tracks.get(src)
    if (existingTrack) {
      const wasRetiring = cancelRetirement(existingTrack)
      existingTrack.phase = 'active'
      existingTrack.sound.loop(options.loop !== false)
      if (wasRetiring)
        existingTrack.sound.mute(isMuted.value)
      if (!existingTrack.sound.playing()) {
        existingTrack.sound.volume(0)
        existingTrack.sound.play()
        fadeTo(existingTrack.sound, 0, targetVolume(), fade)
      }
      else if (wasRetiring) {
        fadeTo(
          existingTrack.sound,
          existingTrack.sound.volume() as number,
          targetVolume(),
          fade,
        )
      }
      return
    }

    const sound = new Howl({
      src: [src],
      volume: 0,
      loop: options.loop !== false,
      mute: isMuted.value,
      onloaderror: (_id, error) => {
        $adv.compileDiagnostics.value = [
          ...$adv.compileDiagnostics.value.filter(diagnostic => (
            diagnostic.code !== 'ADV_RUNTIME_RESOURCE_LOAD_FAILED' || !diagnostic.message.includes(src)
          )),
          {
            code: 'ADV_RUNTIME_RESOURCE_LOAD_FAILED',
            severity: 'warning',
            message: `Unable to load BGM: ${src} (${String(error)})`,
          },
        ]
      },
    })
    tracks.set(src, {
      generation: 0,
      phase: 'active',
      sound,
    })
    sound.play()
    fadeTo(sound, 0, targetVolume(), fade)
  }

  function stopOtherTracks(src: string, options: BgmFadeOptions = {}) {
    for (const key of tracks.keys()) {
      if (key !== src) {
        stopTrack(key, options)
        // note: actual stop happens in fade callback below
      }
    }
  }

  function switchTrack(src: string, options: BgmFadeOptions = {}) {
    stopOtherTracks(src, { fade: options.fadeOut ?? options.fade })
    startTrack(src, {
      fade: options.fadeIn ?? options.fade,
      loop: options.loop,
    })
  }

  function pauseTrack(src: string) {
    const track = tracks.get(src)
    if (!track)
      return
    track.sound.pause()
    if (activeSrc === src)
      track.phase = 'paused'
  }

  function stopTrack(src: string, options: BgmFadeOptions = {}) {
    const fade = options.fade ?? DEFAULT_FADE_OUT
    const track = tracks.get(src)
    if (!track)
      return
    if (activeSrc === src)
      activeSrc = undefined
    cancelRetirement(track)
    if (fade <= 0 || !track.sound.playing()) {
      releaseTrack(src, track)
      return
    }
    const currentVolume = track.sound.volume() as number
    if (currentVolume <= 0) {
      releaseTrack(src, track)
      return
    }
    track.phase = 'retiring'
    const generation = ++track.generation
    const listener = () => {
      releaseTrack(src, track, generation)
    }
    track.sound.fade(currentVolume, 0, fade)
    track.stopListener = listener
    track.sound.once('fade', listener)
  }

  function applyVolumeToActiveTrack() {
    if (!activeSrc)
      return
    tracks.get(activeSrc)?.sound.volume(targetVolume())
  }

  /**
   * set master bgm volume (0..1)
   */
  function setVolume(v: number) {
    volume.value = Math.min(1, Math.max(0, v))
    applyVolumeToActiveTrack()
  }

  function sync(value: string, options: BgmFadeOptions = {}) {
    if (!value) {
      for (const src of [...tracks.keys()])
        stopTrack(src, { fade: options.fadeOut ?? options.fade })
      return
    }
    switchTrack(getBgmSrc(value), options)
  }

  return {
    playBgmBySrc: switchTrack,
    pauseBgmBySrc: pauseTrack,
    stopBgmBySrc: stopTrack,
    stopOtherBgmBySrc: stopOtherTracks,
    sync(value: string) {
      return sync(value)
    },

    syncWithOptions(value: string, options: BgmFadeOptions = {}) {
      return sync(value, options)
    },

    /**
     * 播放指定的背景音乐
     */
    playBgm: (bgmId: string, options?: BgmFadeOptions) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      switchTrack(getBgmSrc(bgm.name), options)
    },

    pauseBgm: (bgmId: string) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      const bgmSrc = getBgmSrc(bgm.name)
      pauseTrack(bgmSrc)
    },
    stopBgm: (bgmId: string, options?: BgmFadeOptions) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      const bgmSrc = getBgmSrc(bgm.name)
      stopTrack(bgmSrc, options)
    },
    play() {
      if (!activeSrc)
        return
      const track = tracks.get(activeSrc)
      if (track && !track.sound.playing()) {
        track.sound.play()
        track.phase = 'active'
      }
    },
    /**
     * stop all bgms
     */
    stop(options?: BgmFadeOptions) {
      for (const src of [...tracks.keys()]) {
        stopTrack(src, options)
      }
    },
    dispose() {
      for (const track of tracks.values()) {
        cancelRetirement(track)
        track.sound.unload()
      }
      tracks.clear()
      activeSrc = undefined
    },
    isMuted,
    volume,
    setVolume,
    /**
     * mute
     */
    mute() {
      isMuted.value = true
      for (const track of tracks.values()) {
        track.sound.mute(true)
      }
    },
    /**
     * 解除静音
     */
    unmute() {
      isMuted.value = false
      if (!activeSrc)
        return
      const track = tracks.get(activeSrc)
      if (track) {
        track.sound.mute(false)
        track.sound.volume(volume.value)
      }
    },
    /**
     * 切换静音状态
     */
    toggleMute() {
      return isMuted.value ? this.unmute() : this.mute()
    },
  }
}
