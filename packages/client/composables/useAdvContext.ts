// import { useAdvConfig } from '../../composables'
import { injectLocal } from '@vueuse/core'
import { injectionAdvContext } from '../constants'

/**
 * advjs context
 */
export function useAdvContext() {
  const $adv = injectLocal(injectionAdvContext)!

  return {
    $adv,
  }
}
