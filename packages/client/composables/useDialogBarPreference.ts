import type { DialogBarMode } from '../stores/settings/types'
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

/** Persist the player's display preference without modifying story saves. */
export function useDialogBarPreference() {
  const settings = useSettingsStore()
  return computed<DialogBarMode>({
    get: () => {
      const value = settings.storage.dialogBar
      return value === 'auto' || value === 'collapsed' ? value : 'always'
    },
    set: (value) => { settings.storage.dialogBar = value },
  })
}
