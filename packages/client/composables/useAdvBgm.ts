import type { AdvMusic } from '@advjs/types'
import type { AdvContext } from '../types'

import { Howl } from 'howler'
import { ref } from 'vue'

/**
 * adv bgm system & utilities
 * @param $adv
 */
export function useAdvBgm($adv: AdvContext) {
  const bgmMap = new Map<string, Howl>()

  const volume = ref(0.5)
  const isMuted = ref(false)

  function getBgmSrc(bgmKey: string) {
    const bgmLibrary = ($adv.gameConfig.value.bgm?.library || {}) as Record<string, AdvMusic>
    const cdnUrl = $adv.config.value.cdn.prefix || 'https://cos.advjs.yunle.fun'
    const bgmName = bgmLibrary[bgmKey]?.src || bgmKey
    return `${cdnUrl}/bgms/library/${bgmName}.mp3`
  }

  return {
    /**
     * 播放指定的背景音乐
     * @param bgmId
     */
    playBgm: (bgmId: string) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      if (bgm) {
        if (bgmMap.has(bgm.name)) {
          const sound = bgmMap.get(bgm.name)
          if (!sound?.playing()) {
            sound?.play()
          }
          // continue
        }
        else {
          const src = getBgmSrc(bgm.name)
          const sound = new Howl({
            src: [src],
            volume: isMuted.value ? 0 : volume.value,
            loop: true,
          })
          sound.play()
          bgmMap.set(bgm.name, sound)
        }
      }
    },
    pauseBgm: (bgmId: string) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      if (bgm) {
        const sound = bgmMap.get(bgm.name)
        if (sound) {
          sound.pause()
        }
      }
    },
    stopBgm: (bgmId: string) => {
      const bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      if (bgm) {
        const sound = bgmMap.get(bgm.name)
        if (sound) {
          sound.stop()
          bgmMap.delete(bgm.name)
        }
      }
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
