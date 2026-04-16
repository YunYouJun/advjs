import { useOnline } from '@vueuse/core'

/**
 * Reactive network status detection.
 * Based on `@vueuse/core` `useOnline()`.
 */
export function useNetworkStatus() {
  const isOnline = useOnline()
  return { isOnline }
}
