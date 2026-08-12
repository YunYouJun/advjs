import type { MotionPreference } from '../stores/settings/types'
import { useMediaQuery } from '@vueuse/core'
import { computed } from 'vue'
import { useSettingsStore } from '../stores'

/** Resolve the game setting while always honoring the operating-system preference. */
export function useAdvMotionPreference() {
  const settings = useSettingsStore()
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  return computed<MotionPreference>(() => {
    if (prefersReducedMotion.value)
      return 'none'
    return settings.storage.animation.motion ?? 'full'
  })
}
