import { acceptHMRUpdate, defineStore } from 'pinia'
import { useToggle } from '@vueuse/core'
import { useSound } from '@vueuse/sound'

import { popDownUrl, popUpOffUrl, popUpOnUrl } from '@advjs/theme-default'
import { computed, ref } from 'vue'
// @ts-expect-error virtual module
import config from '/@advjs/configs'

/**
 * audio system store
 */
export const useAudioStore = defineStore('audio', () => {
  const defaultMusicVolume = 0.5
  const defaultSoundVolume = 0.25
  const musicVolume = ref(defaultMusicVolume)
  const soundVolume = ref(defaultSoundVolume)

  const [isMusicMuted, toggleMusicMuted] = useToggle(false)
  const [isSoundMuted, toggleSoundMuted] = useToggle(false)

  const sVolume = computed(() => isSoundMuted.value ? 0 : soundVolume.value)
  const mVolume = computed(() => isMusicMuted.value ? 0 : musicVolume.value)

  // @ts-expect-error wait https://github.com/vueuse/sound/pull/25
  const curBgm = useSound(config.bgm?.collection[0]?.src, { loop: true, volume: mVolume })

  // toggle background music
  const toggleBgm = () => {
    if (curBgm.isPlaying.value) {
      curBgm.pause()
      isMusicMuted.value = true
    }
    else {
      curBgm.play()
      isMusicMuted.value = false
    }
  }

  const popDown = useSound(popDownUrl, { volume: sVolume })
  const popUpOn = useSound(popUpOnUrl, { volume: sVolume })
  const popUpOff = useSound(popUpOffUrl, { volume: sVolume })

  const reset = () => {
    soundVolume.value = defaultSoundVolume
    musicVolume.value = defaultMusicVolume
  }

  return {
    curBgm,
    toggleBgm,

    isMusicMuted,
    isSoundMuted,

    musicVolume,
    soundVolume,

    toggleMusicMuted,
    toggleSoundMuted,

    reset,

    popDown,
    popUpOff,
    popUpOn,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAudioStore, import.meta.hot))
