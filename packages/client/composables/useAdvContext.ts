// import { useAdvConfig } from '../../composables'
import { injectLocal } from '@vueuse/core'
import { toRef } from 'vue'
import { injectionAdvContext } from '../constants'

/**
 * advjs context
 */
export function useAdvContext() {
  const $adv = injectLocal(injectionAdvContext)!
  const $nav = toRef($adv, 'nav')

  return {
    $adv,
    $nav,
  }
}
