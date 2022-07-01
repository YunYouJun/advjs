import { popDownUrl, popUpOffUrl, popUpOnUrl } from '@advjs/theme-default'
import { useSound } from '@vueuse/sound'
import { computed, ref } from 'vue'
import { useToggle } from '@vueuse/core'

/**
 * audio system
 * @returns
 */
export function useAudio() {
  const defaultMusicVolume = 0.5
  const defaultSoundVolume = 0.25
  const musicVolume = ref(defaultMusicVolume)
  const soundVolume = ref(defaultSoundVolume)

  const [isMusicMuted, toggleMusicMuted] = useToggle(false)
  const [isSoundMuted, toggleSoundMuted] = useToggle(false)

  const sVolume = computed(() => isSoundMuted.value ? 0 : soundVolume.value)

  const popDown = useSound(popDownUrl, { volume: sVolume })
  const popUpOn = useSound(popUpOnUrl, { volume: sVolume })
  const popUpOff = useSound(popUpOffUrl, { volume: sVolume })

  const reset = () => {
    soundVolume.value = defaultSoundVolume
    musicVolume.value = defaultMusicVolume
  }

  return {
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
}
