import { useStorage, useToggle } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'

// @vueuse/sound not reactive
import { computed, ref } from 'vue'
import { assets } from '../assets'
import { useSound } from '../composables'

/**
 * audio system store
 */
export const useAudioStore = defineStore('@advjs/client/audio', () => {
  const defaultSoundVolume = 0.25
  const defaultBgmVolume = 0.5
  const soundVolume = ref(defaultSoundVolume)

  const [isSoundMuted, toggleSoundMuted] = useToggle(false)

  const sVolume = computed(() => isSoundMuted.value ? 0 : soundVolume.value)

  /**
   * persisted master bgm volume, synced with $adv.$bgm.volume
   */
  const bgmVolume = useStorage('advjs-bgm-volume', defaultBgmVolume)

  const bgmUrl = ref(assets.audios.popUpOnUrl)

  const setBgm = (url: string) => {
    bgmUrl.value = url
  }

  const popDown = useSound(assets.audios.popDownUrl, { volume: sVolume })
  const popUpOn = useSound(assets.audios.popUpOnUrl, { volume: sVolume })
  const popUpOff = useSound(assets.audios.popUpOffUrl, { volume: sVolume })

  const reset = () => {
    soundVolume.value = defaultSoundVolume
    bgmVolume.value = defaultBgmVolume
  }

  return {
    setBgm,

    isSoundMuted,

    soundVolume,
    bgmVolume,

    toggleSoundMuted,

    reset,

    popDown,
    popUpOff,
    popUpOn,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAudioStore, import.meta.hot))
