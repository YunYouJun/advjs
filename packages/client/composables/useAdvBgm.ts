import type { AdvMusic } from '@advjs/types'
import type { AdvContext } from '../types'

import { Howl } from 'howler'
import { ref } from 'vue'

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

  /**
   * 获取背景音乐的源地址
   * @param bgmKey 背景音乐的键
   * @returns 背景音乐的源地址
   */
  function getBgmSrc(bgmKey: string) {
    const bgmLibrary = ($adv.gameConfig.value.bgm?.library || {}) as Record<string, AdvMusic>
    const cdnUrl = $adv.config.value.cdn.prefix || 'https://cos.advjs.yunle.fun'
    const bgmName = bgmLibrary[bgmKey]?.src || bgmKey
    return `${cdnUrl}/bgms/library/${bgmName}.mp3`
  }

  /**
   * play bgm by src
   */
  function playBgmBySrc(src: string) {
    if (bgmMap.has(src)) {
      const sound = bgmMap.get(src)
      if (sound && !sound.playing()) {
        sound.play()
      }
    }
    else {
      const sound = new Howl({
        src: [src],
        volume: isMuted.value ? 0 : volume.value,
        loop: true,
      })
      sound.play()
      bgmMap.set(src, sound)
    }
  }

  /**
   * 停止之外的所有背景音乐
   */
  function stopOtherBgmBySrc(src: string) {
    for (const [key, sound] of bgmMap.entries()) {
      if (key !== src && sound.playing()) {
        sound.stop()
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
   * stop bgm by src
   */
  function stopBgmBySrc(src: string) {
    const sound = bgmMap.get(src)
    if (sound) {
      sound.stop()
      bgmMap.delete(src)
    }
  }

  return {
    playBgmBySrc,
    pauseBgmBySrc,
    stopBgmBySrc,
    stopOtherBgmBySrc,

    /**
     * 播放指定的背景音乐
     * @param bgmId
     */
    playBgm: (bgmId: string) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      const bgmSrc = getBgmSrc(bgm.name)
      stopOtherBgmBySrc(bgmSrc)

      playBgmBySrc(bgmSrc)
    },

    pauseBgm: (bgmId: string) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      const bgmSrc = getBgmSrc(bgm.name)
      pauseBgmBySrc(bgmSrc)
    },
    stopBgm: (bgmId: string) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      const bgmSrc = getBgmSrc(bgm.name)
      stopBgmBySrc(bgmSrc)
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
    stop() {
      for (const sound of bgmMap.values()) {
        if (sound.playing()) {
          sound.stop()
        }
      }
    },
    isMuted,
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
