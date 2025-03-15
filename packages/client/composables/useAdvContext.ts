// import { useAdvConfig } from '../../composables'
import { injectLocal } from '@vueuse/core'
import { toRef } from 'vue'
import { injectionAdvContext } from '../constants'
import { useAdvStore } from '../stores'

/**
 * advjs context
 */
export function useAdvContext() {
  const $adv = injectLocal(injectionAdvContext)!
  const $nav = toRef($adv, 'nav')

  const $store = useAdvStore()

  return {
    $adv,
    $nav,
    $store,
  }
}
