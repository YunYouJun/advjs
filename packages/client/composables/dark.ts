import { useDark } from '@vueuse/core'
import { computed } from 'vue'

// Legacy host controls are opt-in: importing the client must not restyle its host.
// Game components use useGameColorMode instead.
let hostControlEnabled = false
const hostIsDark = useDark({
  onChanged(value) {
    if (hostControlEnabled && typeof document !== 'undefined')
      document.documentElement.classList.toggle('dark', value)
  },
})
/** @deprecated Use useGameColorMode inside game UI. Setting this ref changes the host. */
export const isDark = computed({
  get: () => hostIsDark.value,
  set(value: boolean) {
    hostControlEnabled = true
    hostIsDark.value = value
    if (typeof document !== 'undefined')
      document.documentElement.classList.toggle('dark', value)
  },
})
/** @deprecated Explicitly changes the host document, not a game container. */
export function toggleDark(value = !isDark.value) {
  isDark.value = value
  return value
}
