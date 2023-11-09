import { acceptHMRUpdate, defineStore } from 'pinia'
import { useToggle } from '@vueuse/core'

// @vueuse/sound not reactive
import { computed, ref } from 'vue'
import { useSound } from '@advjs/core'
import { assets } from '../assets'

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

  const bgmUrl = ref(assets.audios.popUpOnUrl)
  // @ts-expect-error wait https://github.com/vueuse/sound/pull/25
  const curBgm = useSound(bgmUrl, { loop: true, volume: mVolume })

  const setBgm = (url: string) => {
    bgmUrl.value = url
  }

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

  const popDown = useSound(assets.audios.popDownUrl, { volume: sVolume })
  const popUpOn = useSound(assets.audios.popUpOnUrl, { volume: sVolume })
  const popUpOff = useSound(assets.audios.popUpOffUrl, { volume: sVolume })

  const reset = () => {
    soundVolume.value = defaultSoundVolume
    musicVolume.value = defaultMusicVolume
  }

  return {
    curBgm,
    setBgm,
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
