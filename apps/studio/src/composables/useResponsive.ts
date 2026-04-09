import { useMediaQuery } from '@vueuse/core'

/**
 * Reactive responsive breakpoints for desktop/tablet/mobile layouts.
 *
 * - isDesktop: ≥768px (tablet landscape / desktop)
 * - isWide: ≥1024px (desktop)
 */
export function useResponsive() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const isWide = useMediaQuery('(min-width: 1024px)')
  return { isDesktop, isWide }
}
