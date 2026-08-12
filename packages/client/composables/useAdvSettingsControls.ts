import type { MotionPreference } from '../stores/settings/types'
import { useFullscreen } from '@vueuse/core'
import { computed } from 'vue'
import { useSettingsStore } from '../stores'
import { useScreenLock } from './useScreenLock'

/** Stable state/actions for project-defined settings panels. */
export function useAdvSettingsControls() {
  const settings = useSettingsStore()
  const fullscreen = useFullscreen()
  const screen = useScreenLock()
  const motion = computed({
    get: () => settings.storage.animation.motion ?? 'full',
    set: (value: MotionPreference) => {
      settings.storage.animation.motion = value
    },
  })

  async function toggleLandscape() {
    if (fullscreen.isFullscreen.value) {
      await fullscreen.exit()
      screen.toggle('portrait')
    }
    else {
      await fullscreen.enter()
      screen.toggle('landscape')
    }
  }

  return {
    settings,
    motion,
    isFullscreen: fullscreen.isFullscreen,
    orientation: screen.orientation,
    toggleFullscreen: () => fullscreen.isFullscreen.value ? fullscreen.exit() : fullscreen.enter(),
    toggleLandscape,
    reset: settings.resetSettings,
  }
}
