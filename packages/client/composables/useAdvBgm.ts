import type { AdvMusic } from '@advjs/types'
import type { AdvContext } from '../types'

import { getBgmSrcUrl } from '@advjs/core'
import { Howl } from 'howler'
import { ref } from 'vue'

const DEFAULT_FADE_IN = 800
const DEFAULT_FADE_OUT = 600

interface BgmFadeOptions {
  fade?: number
}

/**
 * adv bgm system & utilities
 * @param $adv
 */
export function useAdvBgm($adv: AdvContext) {
  /**
   * key is src
   */
  const bgmMap = new Map<string, Howl>()

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

  /**
   * play bgm by src with fade-in
   */
  function playBgmBySrc(src: string, options: BgmFadeOptions = {}) {
    const fade = options.fade ?? DEFAULT_FADE_IN
    if (bgmMap.has(src)) {
      const sound = bgmMap.get(src)
      if (sound && !sound.playing()) {
        sound.volume(0)
        sound.play()
        sound.fade(0, targetVolume(), fade)
      }
    }
    else {
      const sound = new Howl({
        src: [src],
        volume: 0,
        loop: true,
      })
      sound.play()
      sound.fade(0, targetVolume(), fade)
      bgmMap.set(src, sound)
    }
  }

  /**
   * 停止之外的所有背景音乐
   */
  function stopOtherBgmBySrc(src: string, options: BgmFadeOptions = {}) {
    for (const [key, sound] of bgmMap.entries()) {
      if (key !== src && sound.playing()) {
        stopBgmBySrc(key, options)
        // note: actual stop happens in fade callback below
      }
    }
  }

  /**
   * pause bgm by src
   */
  function pauseBgmBySrc(src: string) {
    const sound = bgmMap.get(src)
    if (sound) {
      sound.pause()
    }
  }

  /**
   * stop bgm by src with fade-out
   */
  function stopBgmBySrc(src: string, options: BgmFadeOptions = {}) {
    const fade = options.fade ?? DEFAULT_FADE_OUT
    const sound = bgmMap.get(src)
    if (!sound)
      return
    if (fade <= 0 || !sound.playing()) {
      sound.stop()
      bgmMap.delete(src)
      return
    }
    const cur = sound.volume() as number
    sound.once('fade', () => {
      sound.stop()
      bgmMap.delete(src)
    })
    sound.fade(cur, 0, fade)
  }

  /**
   * apply current master volume to all live tracks
   */
  function applyVolumeToAll() {
    const v = targetVolume()
    for (const sound of bgmMap.values()) {
      sound.volume(v)
    }
  }

  /**
   * set master bgm volume (0..1)
   */
  function setVolume(v: number) {
    volume.value = Math.min(1, Math.max(0, v))
    applyVolumeToAll()
  }

  return {
    playBgmBySrc,
    pauseBgmBySrc,
    stopBgmBySrc,
    stopOtherBgmBySrc,
    sync(value: string) {
      if (!value) {
        for (const src of [...bgmMap.keys()])
          stopBgmBySrc(src)
        return
      }
      const src = getBgmSrc(value)
      stopOtherBgmBySrc(src)
      playBgmBySrc(src)
    },

    /**
     * 播放指定的背景音乐
     */
    playBgm: (bgmId: string, options?: BgmFadeOptions) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      const bgmSrc = getBgmSrc(bgm.name)
      stopOtherBgmBySrc(bgmSrc, options)

      playBgmBySrc(bgmSrc, options)
    },

    pauseBgm: (bgmId: string) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      const bgmSrc = getBgmSrc(bgm.name)
      pauseBgmBySrc(bgmSrc)
    },
    stopBgm: (bgmId: string, options?: BgmFadeOptions) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      const bgmSrc = getBgmSrc(bgm.name)
      stopBgmBySrc(bgmSrc, options)
    },
    play() {
      for (const sound of bgmMap.values()) {
        if (!sound.playing()) {
          sound.play()
        }
      }
    },
    /**
     * stop all bgms
     */
    stop(options?: BgmFadeOptions) {
      for (const src of [...bgmMap.keys()]) {
        stopBgmBySrc(src, options)
      }
    },
    isMuted,
    volume,
    setVolume,
    /**
     * mute
     */
    mute() {
      for (const sound of bgmMap.values()) {
        sound.mute(true)
      }
      isMuted.value = true
    },
    /**
     * 解除静音
     */
    unmute() {
      for (const sound of bgmMap.values()) {
        sound.mute(false)
      }
      isMuted.value = false
    },
    /**
     * 切换静音状态
     */
    toggleMute() {
      return isMuted.value ? this.unmute() : this.mute()
    },
  }
}
