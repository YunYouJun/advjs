import type { AdvMusic } from '@advjs/types'
import type { AdvContext } from '../types'

import { Howl } from 'howler'

export function useAdvBgm($adv: AdvContext) {
  let bgmLibrary = $adv.gameConfig.value.bgm?.library || {}
  if (typeof bgmLibrary === 'string') {
    fetch(bgmLibrary)
      .then(res => res.json())
      .then((data) => {
        bgmLibrary = data
      })
  }

  const bgmMap = new Map<string, Howl>()

  return {
    /**
     * 播放指定的背景音乐
     * @param bgmId
     */
    playBgm: (bgmId: string) => {
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      if (bgm) {
        const cdnUrl = $adv.config.value.cdn.prefix
        const src = `${cdnUrl}/bgms/${bgm.name}.mp3`
        const sound = new Howl({
          src: [src],
        })
        sound.play()

        bgmMap.set(bgm.name, sound)
      }
    },
    pauseBgm: (bgmId: string) => {
      const bgm = (bgmLibrary as Record<string, AdvMusic>)[bgmId]
      if (bgm) {
        const sound = bgmMap.get(bgm.name)
        if (sound) {
          sound.pause()
        }
      }
    },
    stopBgm: (bgmId: string) => {
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
    stop() {
      for (const sound of bgmMap.values()) {
        if (sound.playing()) {
          sound.stop()
        }
      }
    },
  }
}
