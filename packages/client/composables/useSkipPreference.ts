import type { SkipMode } from '../stores/settings/types'
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

/** Persist whether skip mode may pass unread text, independent of story saves. */
export function useSkipPreference() {
  const settings = useSettingsStore()
  return computed<SkipMode>({
    get: () => settings.storage.skip === 'all' ? 'all' : 'read',
    set: (value) => { settings.storage.skip = value },
  })
}
